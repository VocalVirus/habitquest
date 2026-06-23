import { pool } from '../db.js';

// Maps real-world habits to RPG stats over the last 7 days
export async function recalculateStats(userId) {
  const { rows } = await pool.query(
    `SELECT habit_type, SUM(value) as total
     FROM habit_logs
     WHERE user_id = $1 AND logged_date >= NOW() - INTERVAL '7 days'
     GROUP BY habit_type`,
    [userId]
  );

  const t = Object.fromEntries(rows.map((r) => [r.habit_type, parseFloat(r.total)]));

  const strength     = Math.min(100, Math.round((t.gym       || 0) * 5));
  const intelligence = Math.min(100, Math.round((t.study     || 0) * 3));
  const agility      = Math.min(100, Math.round((t.walk      || 0) * 2));
  const vitality     = Math.min(100, Math.round(((t.sleep    || 0) / 56) * 100)); // 56h ideal/week
  const wisdom       = Math.min(100, Math.round((t.reading   || 0) * 4));         // 25h reading/week = 100
  const constitution = Math.min(100, Math.round(((t.water    || 0) / 56) * 100)); // 8 glasses/day × 7 = 56
  const focus        = Math.min(100, Math.round(((t.meditation || 0) / 7) * 100)); // 7 min/day avg = 100% at 49min/wk... actually 60min/week = 100
  const gold         = Math.round(t.save_money || 0);                              // direct dollar → gold

  const level = Math.floor((strength + intelligence + agility + vitality + wisdom + constitution + focus) / 70) + 1;

  await pool.query(
    `UPDATE characters
     SET strength=$1, intelligence=$2, agility=$3, vitality=$4,
         wisdom=$5, constitution=$6, focus=$7, gold=$8, level=$9
     WHERE user_id=$10`,
    [strength, intelligence, agility, vitality, wisdom, constitution, focus, gold, level, userId]
  );
}
