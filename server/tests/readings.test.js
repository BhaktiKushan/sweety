const { request, app, db, resetDb, createUser, auth, addReading } = require('./helpers');

let user;
let other;

// A fixed past date keeps tests independent of the day they run.
const DAY = '2026-10-15';

beforeAll(async () => {
  await resetDb();
});

beforeEach(async () => {
  await db.query('TRUNCATE users RESTART IDENTITY CASCADE');
  user = await createUser({ email: 'owner@example.com' });
  other = await createUser({ email: 'other@example.com' });
});

afterAll(async () => {
  await db.pool.end();
});

describe('create reading', () => {
  test('creates a valid reading', async () => {
    const res = await addReading(user.token, { date: DAY, slot: 'morning', value: 95 });
    expect(res.status).toBe(201);
    expect(res.body.reading).toMatchObject({ date: DAY, slot: 'morning', value: 95, slot_label: 'Morning (fasting)' });
  });

  test('missing value -> "Please enter a glucose value."', async () => {
    const res = await addReading(user.token, { date: DAY, slot: 'morning' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Please enter a glucose value.');
  });

  test.each([39, 601, 0, -5, 100.5, 'abc'])('value %s outside 40-600 whole numbers is rejected', async (value) => {
    const res = await addReading(user.token, { date: DAY, slot: 'morning', value });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Value must be between 40 and 600 mg/dl.');
  });

  test('boundary values 40 and 600 are accepted', async () => {
    expect((await addReading(user.token, { date: DAY, slot: 'morning', value: 40 })).status).toBe(201);
    expect((await addReading(user.token, { date: DAY, slot: 'after_lunch', value: 600 })).status).toBe(201);
  });

  test('future date is rejected', async () => {
    const res = await addReading(user.token, { date: '2999-01-01', slot: 'morning', value: 100 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Date cannot be in the future.');
  });

  test('one reading per slot per day -> duplicate slot message names the slot', async () => {
    await addReading(user.token, { date: DAY, slot: 'after_lunch', value: 130 });
    const res = await addReading(user.token, { date: DAY, slot: 'after_lunch', value: 150 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('You already have an After lunch reading for this date.');
  });

  test('same slot on a different day is fine', async () => {
    await addReading(user.token, { date: DAY, slot: 'morning', value: 100 });
    const res = await addReading(user.token, { date: '2026-10-16', slot: 'morning', value: 100 });
    expect(res.status).toBe(201);
  });

  test('maximum 4 readings per day', async () => {
    for (const slot of ['morning', 'after_breakfast', 'after_lunch', 'after_dinner']) {
      expect((await addReading(user.token, { date: DAY, slot, value: 100 })).status).toBe(201);
    }
    const res = await addReading(user.token, { date: DAY, slot: 'morning', value: 110 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('You can add only 4 readings per day.');
  });
});

describe('update and delete', () => {
  test('updates a reading value', async () => {
    const created = (await addReading(user.token, { date: DAY, slot: 'morning', value: 95 })).body.reading;
    const res = await request(app)
      .put(`/api/readings/${created.id}`)
      .set(auth(user.token))
      .send({ date: DAY, slot: 'morning', value: 105, notes: 'felt fine' });
    expect(res.status).toBe(200);
    expect(res.body.reading.value).toBe(105);
    expect(res.body.reading.notes).toBe('felt fine');
  });

  test('deletes a reading', async () => {
    const created = (await addReading(user.token, { date: DAY, slot: 'morning', value: 95 })).body.reading;
    expect((await request(app).delete(`/api/readings/${created.id}`).set(auth(user.token))).status).toBe(200);
    expect((await request(app).delete(`/api/readings/${created.id}`).set(auth(user.token))).status).toBe(404);
  });
});

describe('per-user data isolation', () => {
  test('users only see their own readings', async () => {
    await addReading(user.token, { date: DAY, slot: 'morning', value: 95 });
    await addReading(other.token, { date: DAY, slot: 'morning', value: 180 });

    const mine = await request(app).get('/api/readings').set(auth(user.token));
    expect(mine.body.total).toBe(1);
    expect(mine.body.readings[0].value).toBe(95);

    const theirs = await request(app).get('/api/readings').set(auth(other.token));
    expect(theirs.body.total).toBe(1);
    expect(theirs.body.readings[0].value).toBe(180);
  });

  test("another user cannot edit or delete someone else's reading", async () => {
    const created = (await addReading(user.token, { date: DAY, slot: 'morning', value: 95 })).body.reading;
    const upd = await request(app)
      .put(`/api/readings/${created.id}`)
      .set(auth(other.token))
      .send({ date: DAY, slot: 'morning', value: 400 });
    expect(upd.status).toBe(404);
    expect((await request(app).delete(`/api/readings/${created.id}`).set(auth(other.token))).status).toBe(404);
  });

  test('reports are also isolated', async () => {
    await addReading(user.token, { date: DAY, slot: 'morning', value: 95 });
    const res = await request(app).get(`/api/reports/daily?date=${DAY}`).set(auth(other.token));
    expect(res.body.report.count).toBe(0);
  });
});

describe('GET /api/readings filtering and pagination (bonus)', () => {
  beforeEach(async () => {
    for (let d = 1; d <= 5; d++) {
      await addReading(user.token, { date: `2026-10-0${d}`, slot: 'morning', value: 100 + d });
    }
  });

  test('filters by exact date and date range', async () => {
    const one = await request(app).get('/api/readings?date=2026-10-03').set(auth(user.token));
    expect(one.body.total).toBe(1);
    expect(one.body.readings[0].value).toBe(103);

    const range = await request(app).get('/api/readings?from=2026-10-02&to=2026-10-04').set(auth(user.token));
    expect(range.body.total).toBe(3);
  });

  test('paginates with page and limit', async () => {
    const page1 = await request(app).get('/api/readings?page=1&limit=2').set(auth(user.token));
    expect(page1.body.total).toBe(5);
    expect(page1.body.total_pages).toBe(3);
    expect(page1.body.readings).toHaveLength(2);

    const page3 = await request(app).get('/api/readings?page=3&limit=2').set(auth(user.token));
    expect(page3.body.readings).toHaveLength(1);
  });
});

describe('authentication required', () => {
  test('reading routes reject requests without a token', async () => {
    expect((await request(app).get('/api/readings')).status).toBe(401);
    expect((await request(app).post('/api/readings').send({ date: DAY, slot: 'morning', value: 100 })).status).toBe(401);
  });
});
