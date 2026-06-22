import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const HABIT_TYPES = [
  { type: 'gym',   label: 'Gym / Workout', unit: 'hours', statLabel: 'Strength',     icon: '🏋️' },
  { type: 'study', label: 'Study / Work',  unit: 'hours', statLabel: 'Intelligence', icon: '📚' },
  { type: 'walk',  label: 'Walk / Run',    unit: 'km',    statLabel: 'Agility',       icon: '🚶' },
  { type: 'sleep', label: 'Sleep',         unit: 'hours', statLabel: 'Vitality',      icon: '😴' },
];

export default function HabitsPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ gym: '', study: '', walk: '', sleep: '' });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await Promise.all(
        HABIT_TYPES
          .filter((h) => values[h.type] !== '')
          .map((h) =>
            axios.post(`${API}/habits`, {
              habit_type: h.type,
              value: parseFloat(values[h.type]),
              unit: h.unit,
            })
          )
      );
      setSaved(true);
      setTimeout(() => navigate('/game'), 1200);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="habits-page">
      <h1>Today's Habits</h1>
      <p>Log your real-world activities to power up your character</p>
      <form onSubmit={handleSubmit} className="habits-form">
        {HABIT_TYPES.map(({ type, label, unit, statLabel, icon }) => (
          <div key={type} className="habit-row">
            <span className="habit-icon">{icon}</span>
            <label>
              <strong>{label}</strong>
              <small>+{statLabel}</small>
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder={`0 ${unit}`}
              value={values[type]}
              onChange={(e) => setValues({ ...values, [type]: e.target.value })}
            />
          </div>
        ))}
        <button type="submit" disabled={loading}>
          {saved ? 'Saved! Entering world...' : loading ? 'Saving...' : 'Save & Play'}
        </button>
      </form>
    </div>
  );
}
