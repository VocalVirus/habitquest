import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const CHARACTERS = [
  { id: 'char_1', label: 'Warrior', desc: 'Long hair, longsleeve' },
  { id: 'char_2', label: 'Rogue',   desc: 'Pixie cut, leather armour' },
  { id: 'char_3', label: 'Brute',   desc: 'Buzzcut, heavy armour' },
  { id: 'char_4', label: 'Mage',    desc: 'Ponytail, longsleeve' },
];

// Show the "facing down, idle" frame from the walk spritesheet.
// LPC walk sheet: 4 rows (up/left/down/right), 9 frames each, 64x64 per frame.
// Row 2 (down) frame 0 → background-position-y: -(2 * 64) = -128px
function SpritePreview({ id, selected }) {
  return (
    <div style={{
      width: 64,
      height: 64,
      backgroundImage: `url(/sprites/${id}.png)`,
      backgroundPosition: '0px -128px',
      backgroundRepeat: 'no-repeat',
      imageRendering: 'pixelated',
      transform: 'scale(2)',
      transformOrigin: 'top left',
      margin: '0 0 64px 0',
      outline: selected ? '3px solid #ffd700' : 'none',
    }} />
  );
}

export default function CustomizePage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState('char_1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setSaving(true);
    setError('');
    try {
      await axios.patch(`${API}/characters/me/sprite`, { sprite: selected });
      navigate('/game');
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save');
      setSaving(false);
    }
  }

  return (
    <div className="auth-page" style={{ gap: 24 }}>
      <h1>Choose Your Character</h1>
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
        {CHARACTERS.map((c) => (
          <div
            key={c.id}
            onClick={() => setSelected(c.id)}
            style={{
              cursor: 'pointer',
              background: selected === c.id ? '#1a1a2e' : '#0f0f1a',
              border: `2px solid ${selected === c.id ? '#ffd700' : '#333'}`,
              padding: '24px 20px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              width: 140,
            }}
          >
            <SpritePreview id={c.id} selected={selected === c.id} />
            <strong style={{ color: selected === c.id ? '#ffd700' : '#fff', fontSize: '0.9rem' }}>
              {c.label}
            </strong>
            <span style={{ color: '#888', fontSize: '0.75rem', textAlign: 'center' }}>
              {c.desc}
            </span>
          </div>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <button
        onClick={handleConfirm}
        disabled={saving}
        style={{
          padding: '12px 40px',
          background: '#ffd700',
          color: '#0f0f1a',
          border: 'none',
          fontWeight: 'bold',
          cursor: saving ? 'not-allowed' : 'pointer',
          fontFamily: 'monospace',
          fontSize: '0.9rem',
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? 'Saving...' : 'Confirm & Enter World'}
      </button>
      <button
        onClick={() => navigate('/game')}
        style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontFamily: 'monospace' }}
      >
        Skip for now
      </button>
    </div>
  );
}
