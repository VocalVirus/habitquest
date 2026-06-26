import express from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

export const SHOP_ITEMS = {
  speed_potion:   { name: 'Speed Potion',    price: 25,  desc: 'Double speed for 60 seconds' },
  vitality_brew:  { name: 'Vitality Brew',   price: 40,  desc: 'Relax and restore (+5 VIT)',  bonus: 5 },
  scholar_tea:    { name: "Scholar's Tea",   price: 40,  desc: 'Sharpen your mind (+5 INT)',  bonus: 5 },
  focus_candle:   { name: 'Focus Candle',    price: 40,  desc: 'Clear thoughts (+5 FOC)',     bonus: 5 },
  strength_wrap:  { name: "Warrior's Wrap",  price: 60,  desc: 'Feel the power (+5 STR)',     bonus: 5 },
  mystery_box:    { name: 'Mystery Box',     price: 100, desc: "Who knows what's inside..." },
  wooden_sword:   { name: 'Wooden Sword',    price: 50,  desc: 'A solid training blade',      bonus: 8  },
  iron_axe:       { name: 'Iron Axe',        price: 120, desc: 'Heavy and brutal',             bonus: 15 },
  hunters_bow:    { name: "Hunter's Bow",    price: 100, desc: 'Strikes from afar',            bonus: 10 },
  battle_staff:   { name: 'Battle Staff',    price: 150, desc: 'For the wise fighter',         bonus: 12 },
  knights_shield: { name: "Knight's Shield", price: 200, desc: 'Unmovable defense',            bonus: 20 },
};

router.get('/items', (_req, res) => res.json(SHOP_ITEMS));

router.post('/buy/:itemId', async (req, res) => {
  const item = SHOP_ITEMS[req.params.itemId];
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const { rows } = await pool.query(
    'SELECT gold, strength, intelligence, vitality, focus FROM characters WHERE user_id = $1',
    [req.user.userId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Character not found' });
  if (rows[0].gold < item.price) return res.status(400).json({ error: 'Not enough gold' });

  const statCols = {
    vitality_brew:  'vitality',
    scholar_tea:    'intelligence',
    focus_candle:   'focus',
    strength_wrap:  'strength',
    wooden_sword:   'strength',
    iron_axe:       'strength',
    hunters_bow:    'agility',
    battle_staff:   'intelligence',
    knights_shield: 'vitality',
  };
  const statCol = statCols[req.params.itemId];
  const bonus = item.bonus || 0;
  const statClause = statCol ? `, ${statCol} = LEAST(100, ${statCol} + ${bonus})` : '';

  const { rows: updated } = await pool.query(
    `UPDATE characters SET gold = gold - $1${statClause} WHERE user_id = $2
     RETURNING gold, strength, intelligence, vitality, focus`,
    [item.price, req.user.userId]
  );

  res.json({ success: true, item: { ...item, id: req.params.itemId }, character: updated[0] });
});

export default router;
