const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { SLOTS, SLOT_LABELS, isValidDateString } = require('../validation');

const router = express.Router();
router.use(requireAuth);

function round1(n) {
  return Math.round(n * 10) / 10;
}

// Shared aggregate for a user's readings in a date range.
async function summarize(userId, from, to) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS count, MIN(value)::int AS lowest, MAX(value)::int AS highest, AVG(value)::float AS average
     FROM readings
     WHERE user_id = $1 AND date >= $2 AND date <= $3`,
    [userId, from, to]
  );
  const row = result.rows[0];
  return {
    from,
    to,
    count: row.count,
    lowest: row.count ? row.lowest : null,
    highest: row.count ? row.highest : null,
    average: row.count ? round1(row.average) : null,
  };
}

function parseSelectedDate(req, res) {
  const date = req.query.date;
  if (!date || !isValidDateString(date)) {
    res.status(400).json({ error: 'Please pass a valid date as ?date=YYYY-MM-DD.' });
    return null;
  }
  return date;
}

// GET /api/reports/daily?date=YYYY-MM-DD
// The selected date, plus each reading with its slot.
router.get('/daily', async (req, res, next) => {
  try {
    const date = parseSelectedDate(req, res);
    if (!date) return;

    const summary = await summarize(req.userId, date, date);
    const readings = await db.query(
      `SELECT id, date, slot, value, notes FROM readings
       WHERE user_id = $1 AND date = $2
       ORDER BY array_position($3::text[], slot)`,
      [req.userId, date, SLOTS]
    );

    res.json({
      report: { type: 'daily', ...summary },
      readings: readings.rows.map((r) => ({ ...r, slot_label: SLOT_LABELS[r.slot] || r.slot })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/month-to-date?date=YYYY-MM-DD
// 1st of the month to the selected date.
router.get('/month-to-date', async (req, res, next) => {
  try {
    const date = parseSelectedDate(req, res);
    if (!date) return;

    const from = `${date.slice(0, 7)}-01`;
    const summary = await summarize(req.userId, from, date);
    res.json({ report: { type: 'month-to-date', ...summary } });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/previous-month?date=YYYY-MM-DD
// The whole month before the selected date's month.
router.get('/previous-month', async (req, res, next) => {
  try {
    const date = parseSelectedDate(req, res);
    if (!date) return;

    const [y, m] = date.split('-').map(Number);
    const prev = new Date(Date.UTC(y, m - 2, 1)); // month is 1-based; m-2 = previous month (0-based)
    const from = prev.toISOString().slice(0, 10);
    const to = new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);

    const summary = await summarize(req.userId, from, to);
    res.json({ report: { type: 'previous-month', ...summary } });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/series?month=YYYY-MM
// Bonus (charts): per-day average values for one month, used by the line chart.
router.get('/series', async (req, res, next) => {
  try {
    const month = req.query.month;
    if (!/^\d{4}-\d{2}$/.test(month || '')) {
      return res.status(400).json({ error: 'Please pass a valid month as ?month=YYYY-MM.' });
    }
    const from = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

    const result = await db.query(
      `SELECT date, COUNT(*)::int AS count, ROUND(AVG(value)::numeric, 1)::float AS average, MIN(value)::int AS lowest, MAX(value)::int AS highest
       FROM readings
       WHERE user_id = $1 AND date >= $2 AND date <= $3
       GROUP BY date
       ORDER BY date`,
      [req.userId, from, to]
    );
    res.json({ month, from, to, days: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
