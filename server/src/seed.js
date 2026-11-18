// Seed script: creates a demo user with sample readings for the last ~60 days.
// Usage: node src/seed.js   (idempotent - deletes the demo user's old data first)
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');
const migrate = require('./migrate');

const DEMO_USER = {
  name: 'Demo Patient',
  email: 'demo@sweety.app',
  password: 'demo1234',
};

// Deterministic pseudo-random generator so the seeded demo data is stable.
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SLOT_BASE = { morning: 95, after_breakfast: 140, after_lunch: 135, after_dinner: 130 };

async function seed() {
  await migrate();

  const hash = await bcrypt.hash(DEMO_USER.password, 10);

  // Upsert the demo user and clear previous demo readings.
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [DEMO_USER.email]);
  let userId;
  if (existing.rows.length > 0) {
    userId = existing.rows[0].id;
    await db.query('UPDATE users SET name = $1, password_hash = $2 WHERE id = $3', [DEMO_USER.name, hash, userId]);
    await db.query('DELETE FROM readings WHERE user_id = $1', [userId]);
  } else {
    const result = await db.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [DEMO_USER.name, DEMO_USER.email, hash]
    );
    userId = result.rows[0].id;
  }

  const rand = mulberry32(42);
  const slots = Object.keys(SLOT_BASE);
  let inserted = 0;

  const today = new Date();
  for (let daysAgo = 60; daysAgo >= 0; daysAgo--) {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Most days have all 4 readings, a few days miss one or two.
    const todaysSlots = slots.filter(() => rand() > 0.18);
    for (const slot of todaysSlots) {
      const jitter = Math.round((rand() - 0.5) * 60);
      const value = Math.min(600, Math.max(40, SLOT_BASE[slot] + jitter));
      await db.query('INSERT INTO readings (user_id, date, slot, value) VALUES ($1, $2, $3, $4)', [
        userId,
        date,
        slot,
        value,
      ]);
      inserted += 1;
    }
  }

  console.log(`Seeded demo user ${DEMO_USER.email} (password: ${DEMO_USER.password}) with ${inserted} readings over the last 60 days.`);
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}

module.exports = seed;
