import express from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { recalculateStats } from '../services/statsCalculator.js';

const router = express.Router();
router.use(requireAuth);

// Log a habit entry (gym, study, walk, sleep)
router.post('/', async (req, res) => {
  const { habit_type, value, unit, logged_date } = req.body;
  const userId = req.user.userId;
  try {
    const { rows } = await pool.query(
      `INSERT INTO habit_logs (user_id, habit_type, value, unit, logged_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, habit_type, value, unit, logged_date || new Date()]
    );
    await recalculateStats(userId);
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get habit history
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM habit_logs WHERE user_id = $1 ORDER BY logged_date DESC LIMIT 30',
    [req.user.userId]
  );
  res.json(rows);
});

export default router;
