import express from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

router.get('/me', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM characters WHERE user_id = $1',
    [req.user.userId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Character not found' });
  res.json(rows[0]);
});

const VALID_SPRITES = ['char_1', 'char_2', 'char_3', 'char_4'];

router.patch('/me/sprite', async (req, res) => {
  const { sprite } = req.body;
  if (!VALID_SPRITES.includes(sprite)) return res.status(400).json({ error: 'Invalid sprite' });
  const { rows } = await pool.query(
    'UPDATE characters SET sprite = $1 WHERE user_id = $2 RETURNING sprite',
    [sprite, req.user.userId]
  );
  res.json(rows[0]);
});

router.post('/me/position', async (req, res) => {
  const { x, y, map_id } = req.body;
  const { rows } = await pool.query(
    `UPDATE characters SET pos_x = $1, pos_y = $2, map_id = $3
     WHERE user_id = $4 RETURNING pos_x, pos_y, map_id`,
    [x, y, map_id, req.user.userId]
  );
  res.json(rows[0]);
});

export default router;
