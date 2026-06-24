import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth.jsx';
import { createGame } from '../game/index.js';
import ChatOverlay from '../components/ChatOverlay.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function GamePage() {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [character, setCharacter] = useState(null);
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/characters/me`)
      .then(({ data }) => setCharacter(data))
      .catch(() => navigate('/login'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!containerRef.current || gameRef.current || !character) return;
    const g = createGame(containerRef.current, { user, token, character });
    gameRef.current = g;
    setGame(g);

    g.events.on('open-customize', () => {
      g.destroy(true);
      gameRef.current = null;
      setGame(null);
      navigate('/customize');
    });

    return () => {
      g.destroy(true);
      gameRef.current = null;
      setGame(null);
    };
  }, [user, token, character]);

  function handleLogout() {
    gameRef.current?.destroy(true);
    gameRef.current = null;
    setGame(null);
    logout();
    navigate('/login');
  }

  if (loading) return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f1a', color: '#ffd700', fontFamily: 'monospace', fontSize: '1.1rem' }}>
      Entering world...
    </div>
  );

  return (
    <>
      <div ref={containerRef} id="game-container" style={{ width: '100vw', height: '100vh' }} />
      <ChatOverlay game={game} />
      <div style={{
        position: 'fixed', top: 12, right: 12,
        display: 'flex', gap: 8, zIndex: 10,
      }}>
        <button onClick={() => { gameRef.current?.destroy(true); gameRef.current = null; navigate('/habits'); }} style={btnStyle}>Log Habits</button>
        <button onClick={() => { gameRef.current?.destroy(true); gameRef.current = null; navigate('/customize'); }} style={btnStyle}>Customize</button>
        <button onClick={() => { gameRef.current?.destroy(true); gameRef.current = null; navigate('/leaderboard'); }} style={btnStyle}>Leaderboard</button>
        <button onClick={handleLogout} style={btnStyle}>Log Out</button>
      </div>
    </>
  );
}

const btnStyle = {
  padding: '6px 14px',
  background: '#0f0f1acc',
  color: '#ffd700',
  border: '1px solid #ffd700',
  fontFamily: 'monospace',
  fontSize: '0.8rem',
  cursor: 'pointer',
};
