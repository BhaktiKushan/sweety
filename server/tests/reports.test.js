const { request, app, db, resetDb, createUser, auth, addReading } = require('./helpers');

let user;

beforeAll(async () => {
  await resetDb();
});

beforeEach(async () => {
  await db.query('TRUNCATE users RESTART IDENTITY CASCADE');
  user = await createUser({ email: 'reports@example.com' });
});

afterAll(async () => {
  await db.pool.end();
});

// Matches the assignment example: selected date 15 Oct 2026.
const SELECTED = '2026-10-15';

async function seedDays() {
  // Selected day: 4 readings, 90/120/150/180 -> avg 135.0
  await addReading(user.token, { date: SELECTED, slot: 'morning', value: 90 });
  await addReading(user.token, { date: SELECTED, slot: 'after_breakfast', value: 120 });
  await addReading(user.token, { date: SELECTED, slot: 'after_lunch', value: 150 });
  await addReading(user.token, { date: SELECTED, slot: 'after_dinner', value: 180 });
  // Earlier the same month (inside month-to-date)
  await addReading(user.token, { date: '2026-10-02', slot: 'morning', value: 200 });
  // Previous month (inside monthly report)
  await addReading(user.token, { date: '2026-09-10', slot: 'morning', value: 110 });
  await addReading(user.token, { date: '2026-09-30', slot: 'morning', value: 130 });
  // Two months back (must not appear in any of the three reports)
  await addReading(user.token, { date: '2026-08-15', slot: 'morning', value: 400 });
}

describe('daily report', () => {
  test('shows highest, lowest, average (1 decimal) and count, and lists readings with slots', async () => {
    await seedDays();
    const res = await request(app).get(`/api/reports/daily?date=${SELECTED}`).set(auth(user.token));
    expect(res.status).toBe(200);
    expect(res.body.report).toMatchObject({ type: 'daily', from: SELECTED, to: SELECTED, count: 4, lowest: 90, highest: 180, average: 135 });
    expect(res.body.readings).toHaveLength(4);
    expect(res.body.readings[0]).toMatchObject({ slot: 'morning', slot_label: 'Morning (fasting)', value: 90 });
  });

  test('average is rounded to 1 decimal', async () => {
    await addReading(user.token, { date: SELECTED, slot: 'morning', value: 100 });
    await addReading(user.token, { date: SELECTED, slot: 'after_lunch', value: 101 });
    await addReading(user.token, { date: SELECTED, slot: 'after_dinner', value: 102 });
    const res = await request(app).get(`/api/reports/daily?date=${SELECTED}`).set(auth(user.token));
    expect(res.body.report.average).toBe(101); // 303/3 = 101.0
  });

  test('empty day returns a friendly empty state (count 0, nulls)', async () => {
    const res = await request(app).get(`/api/reports/daily?date=${SELECTED}`).set(auth(user.token));
    expect(res.body.report).toMatchObject({ count: 0, lowest: null, highest: null, average: null });
    expect(res.body.readings).toEqual([]);
  });
});

describe('month-to-date report', () => {
  test('covers the 1st of the month to the selected date only', async () => {
    await seedDays();
    const res = await request(app).get(`/api/reports/month-to-date?date=${SELECTED}`).set(auth(user.token));
    expect(res.body.report).toMatchObject({ from: '2026-10-01', to: SELECTED, count: 5, lowest: 90, highest: 200 });
    // avg of 90,120,150,180,200 = 148
    expect(res.body.report.average).toBe(148);
  });
});

describe('previous month report', () => {
  test('covers the whole previous month (1 Sep - 30 Sep for a 15 Oct selection)', async () => {
    await seedDays();
    const res = await request(app).get(`/api/reports/previous-month?date=${SELECTED}`).set(auth(user.token));
    expect(res.body.report).toMatchObject({ from: '2026-09-01', to: '2026-09-30', count: 2, lowest: 110, highest: 130, average: 120 });
  });

  test('handles January (previous month is December of last year)', async () => {
    await addReading(user.token, { date: '2025-12-25', slot: 'morning', value: 150 });
    const res = await request(app).get('/api/reports/previous-month?date=2026-01-10').set(auth(user.token));
    expect(res.body.report).toMatchObject({ from: '2025-12-01', to: '2025-12-31', count: 1, average: 150 });
  });
});

describe('report input validation', () => {
  test('rejects a missing or invalid date', async () => {
    expect((await request(app).get('/api/reports/daily').set(auth(user.token))).status).toBe(400);
    expect((await request(app).get('/api/reports/daily?date=15-10-2026').set(auth(user.token))).status).toBe(400);
    expect((await request(app).get('/api/reports/daily?date=2026-13-01').set(auth(user.token))).status).toBe(400);
  });
});
