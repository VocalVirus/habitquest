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

  const totals = Object.fromEntries(rows.map((r) => [r.habit_type, parseFloat(r.total)]));

  // Stat mapping: gym hours -> STR, study hours -> INT, walk km -> AGI, sleep hours -> VIT
  const strength = Math.min(100, Math.round((totals.gym || 0) * 5));
  const intelligence = Math.min(100, Math.round((totals.study || 0) * 3));
  const agility = Math.min(100, Math.round((totals.walk || 0) * 2));
  const vitality = Math.min(100, Math.round(((totals.sleep || 0) / 56) * 100)); // 56h ideal/week
  const level = Math.floor((strength + intelligence + agility + vitality) / 40) + 1;

  await pool.query(
    `UPDATE characters
     SET strength = $1, intelligence = $2, agility = $3, vitality = $4, level = $5
     WHERE user_id = $6`,
    [strength, intelligence, agility, vitality, level, userId]
  );
}
