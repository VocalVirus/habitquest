import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const STAT_KEYS = ['strength', 'agility', 'vitality', 'constitution', 'intelligence', 'wisdom', 'focus'];

const MEDAL = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${API}/characters/leaderboard`)
      .then(({ data }) => setRows(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalStats = (r) => STAT_KEYS.reduce((s, k) => s + (r[k] || 0), 0);

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>⚔ Leaderboard</h1>
        <p style={subtitleStyle}>Ranked by level, then total stats</p>

        {loading ? (
          <p style={{ color: '#888', textAlign: 'center', padding: 32 }}>Loading...</p>
        ) : rows.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', padding: 32 }}>No heroes yet — be the first!</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                {['#', 'Hero', 'Lv', 'STR', 'AGI', 'VIT', 'CON', 'INT', 'WIS', 'FOC', 'Total', 'Gold'].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.username} style={i % 2 === 0 ? rowEvenStyle : rowOddStyle}>
                  <td style={tdStyle}>{MEDAL[i] ?? i + 1}</td>
                  <td style={{ ...tdStyle, color: '#ffd700', fontWeight: 'bold' }}>{r.username}</td>
                  <td style={{ ...tdStyle, color: '#4caf50' }}>{r.level}</td>
                  {STAT_KEYS.map((k) => (
                    <td key={k} style={tdStyle}>{Math.round(r[k] || 0)}</td>
                  ))}
                  <td style={{ ...tdStyle, color: '#aaa' }}>{Math.round(totalStats(r))}</td>
                  <td style={{ ...tdStyle, color: '#ffd700' }}>{r.gold ?? 0}g</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <button onClick={() => navigate(-1)} style={backBtnStyle}>← Back</button>
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: '100vh',
  background: '#0f0f1a',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '40px 16px',
};

const cardStyle = {
  width: '100%',
  maxWidth: 900,
  background: '#16162a',
  border: '1px solid #2a2a4a',
  borderRadius: 8,
  padding: '28px 24px',
  fontFamily: 'monospace',
};

const titleStyle = {
  fontSize: '1.6rem',
  color: '#ffd700',
  margin: '0 0 4px',
  textAlign: 'center',
};

const subtitleStyle = {
  fontSize: '0.8rem',
  color: '#555',
  textAlign: 'center',
  marginBottom: 24,
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.82rem',
};

const thStyle = {
  color: '#888',
  textAlign: 'center',
  padding: '6px 10px',
  borderBottom: '1px solid #2a2a4a',
  fontWeight: 'normal',
  letterSpacing: '0.05em',
};

const tdStyle = {
  color: '#ccc',
  textAlign: 'center',
  padding: '7px 10px',
};

const rowEvenStyle = { background: 'transparent' };
const rowOddStyle  = { background: 'rgba(255,255,255,0.02)' };

const backBtnStyle = {
  marginTop: 28,
  padding: '7px 18px',
  background: 'transparent',
  color: '#ffd700',
  border: '1px solid #ffd700',
  fontFamily: 'monospace',
  fontSize: '0.85rem',
  cursor: 'pointer',
  borderRadius: 4,
};
