const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { SLOTS, SLOT_LABELS, MESSAGES, validateReading, isValidDateString } = require('../validation');

const router = express.Router();
router.use(requireAuth);

function withLabel(row) {
  return { ...row, slot_label: SLOT_LABELS[row.slot] || row.slot };
}

// GET /api/readings?date=YYYY-MM-DD&from=&to=&page=1&limit=20
router.get('/', async (req, res, next) => {
  try {
    const { date, from, to } = req.query;
    const conditions = ['user_id = $1'];
    const params = [req.userId];

    if (date) {
      if (!isValidDateString(date)) return res.status(400).json({ error: 'Please enter a valid date (YYYY-MM-DD).' });
      params.push(date);
      conditions.push(`date = $${params.length}`);
    }
    if (from) {
      if (!isValidDateString(from)) return res.status(400).json({ error: 'Please enter a valid date (YYYY-MM-DD).' });
      params.push(from);
      conditions.push(`date >= $${params.length}`);
    }
    if (to) {
      if (!isValidDateString(to)) return res.status(400).json({ error: 'Please enter a valid date (YYYY-MM-DD).' });
      params.push(to);
      conditions.push(`date <= $${params.length}`);
    }

    const where = conditions.join(' AND ');

    // Bonus: pagination. Defaults: page 1, 20 per page, max 100 per page.
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const countResult = await db.query(`SELECT COUNT(*)::int AS total FROM readings WHERE ${where}`, params);
    const total = countResult.rows[0].total;

    params.push(limit, offset);
    const result = await db.query(
      `SELECT id, date, slot, value, notes, created_at, updated_at
       FROM readings WHERE ${where}
       ORDER BY date DESC, created_at ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ readings: result.rows.map(withLabel), page, limit, total, total_pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

// POST /api/readings  { date, slot, value, notes? }
router.post('/', async (req, res, next) => {
  try {
    const { date, slot, value, notes } = req.body || {};

    const errors = validateReading({ date, slot, value });
    if (errors.length > 0) return res.status(400).json({ error: errors[0], errors });

    if (isValidDateString(date)) {
      // Rule: maximum 4 readings per day.
      const countResult = await db.query(
        'SELECT COUNT(*)::int AS n FROM readings WHERE user_id = $1 AND date = $2',
        [req.userId, date]
      );
      if (countResult.rows[0].n >= SLOTS.length) {
        return res.status(400).json({ error: MESSAGES.maxPerDay });
      }
    }

    try {
      const result = await db.query(
        `INSERT INTO readings (user_id, date, slot, value, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, date, slot, value, notes, created_at, updated_at`,
        [req.userId, date, slot, Number(value), notes || null]
      );
      res.status(201).json({ reading: withLabel(result.rows[0]) });
    } catch (err) {
      // Unique (user_id, date, slot): one reading per slot per day.
      if (err.code === '23505') {
        return res.status(409).json({ error: MESSAGES.duplicateSlot(SLOT_LABELS[slot]) });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// PUT /api/readings/:id  { date, slot, value, notes? }
router.put('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid reading id.' });

    const { date, slot, value, notes } = req.body || {};
    const errors = validateReading({ date, slot, value });
    if (errors.length > 0) return res.status(400).json({ error: errors[0], errors });

    try {
      const result = await db.query(
        `UPDATE readings
         SET date = $1, slot = $2, value = $3, notes = $4, updated_at = now()
         WHERE id = $5 AND user_id = $6
         RETURNING id, date, slot, value, notes, created_at, updated_at`,
        [date, slot, Number(value), notes || null, id, req.userId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Reading not found.' });
      }
      res.json({ reading: withLabel(result.rows[0]) });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: MESSAGES.duplicateSlot(SLOT_LABELS[slot]) });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// DELETE /api/readings/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid reading id.' });

    const result = await db.query('DELETE FROM readings WHERE id = $1 AND user_id = $2 RETURNING id', [id, req.userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reading not found.' });
    }
    res.json({ deleted: true, id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
