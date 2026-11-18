const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');
const migrate = require('../src/migrate');

async function resetDb() {
  await migrate();
  await db.query('TRUNCATE users RESTART IDENTITY CASCADE');
}

async function createUser(overrides = {}) {
  const payload = { name: 'Test User', email: 'test@example.com', password: 'password123', ...overrides };
  const res = await request(app).post('/api/auth/register').send(payload);
  return { res, ...payload, token: res.body.token, user: res.body.user };
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function addReading(token, reading) {
  return request(app).post('/api/readings').set(auth(token)).send(reading);
}

module.exports = { request, app, db, resetDb, createUser, auth, addReading };
