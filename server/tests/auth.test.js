const { request, app, db, resetDb, createUser, auth } = require('./helpers');

beforeAll(async () => {
  await resetDb();
});

afterAll(async () => {
  await db.pool.end();
});

describe('POST /api/auth/register', () => {
  test('registers a new user and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ana', email: 'ana@example.com', password: 'secret123' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toMatchObject({ name: 'Ana', email: 'ana@example.com' });
    expect(res.body.user.password_hash).toBeUndefined();
  });

  test('stores the password hashed with bcrypt, never plain text', async () => {
    await request(app).post('/api/auth/register').send({ name: 'Bo', email: 'bo@example.com', password: 'secret123' });
    const { rows } = await db.query('SELECT password_hash FROM users WHERE email = $1', ['bo@example.com']);
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/); // bcrypt hash format
    expect(rows[0].password_hash).not.toContain('secret123');
  });

  test('rejects a duplicate email', async () => {
    await request(app).post('/api/auth/register').send({ name: 'Cat', email: 'cat@example.com', password: 'secret123' });
    const res = await request(app).post('/api/auth/register').send({ name: 'Cat2', email: 'cat@example.com', password: 'secret123' });
    expect(res.status).toBe(409);
  });

  test('rejects short passwords, missing name and bad email', async () => {
    expect((await request(app).post('/api/auth/register').send({ name: 'A', email: 'a@b.co', password: '123' })).status).toBe(400);
    expect((await request(app).post('/api/auth/register').send({ name: '', email: 'a@b.co', password: 'secret123' })).status).toBe(400);
    expect((await request(app).post('/api/auth/register').send({ name: 'A', email: 'not-an-email', password: 'secret123' })).status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  test('logs in with correct credentials and rejects wrong ones', async () => {
    await createUser({ email: 'login@example.com', password: 'secret123' });

    const ok = await request(app).post('/api/auth/login').send({ email: 'login@example.com', password: 'secret123' });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();

    const badPw = await request(app).post('/api/auth/login').send({ email: 'login@example.com', password: 'wrong' });
    expect(badPw.status).toBe(401);

    const noUser = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'secret123' });
    expect(noUser.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  test('returns the logged in user, and 401 without a token', async () => {
    const u = await createUser({ email: 'me@example.com' });
    const res = await request(app).get('/api/auth/me').set(auth(u.token));
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@example.com');

    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', 'Bearer garbage')).status).toBe(401);
  });
});
