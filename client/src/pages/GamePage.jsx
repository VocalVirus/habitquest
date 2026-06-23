import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth.jsx';
import { createGame } from '../game/index.js';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function GamePage() {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [character, setCharacter] = useState(null);

  useEffect(() => {
    axios.get(`${API}/characters/me`).then(({ data }) => setCharacter(data));
  }, [token]);

  useEffect(() => {
    if (!containerRef.current || gameRef.current || !character) return;
    gameRef.current = createGame(containerRef.current, { user, token, character });

    gameRef.current.events.on('open-customize', () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
      navigate('/customize');
    });

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [user, token, character]);

  function handleLogout() {
    gameRef.current?.destroy(true);
    gameRef.current = null;
    logout();
    navigate('/login');
  }

  return (
    <>
      <div ref={containerRef} id="game-container" style={{ width: '100vw', height: '100vh' }} />
      <div style={{
        position: 'fixed', top: 12, right: 12,
        display: 'flex', gap: 8, zIndex: 10,
      }}>
        <button onClick={() => { gameRef.current?.destroy(true); gameRef.current = null; navigate('/habits'); }} style={btnStyle}>Log Habits</button>
        <button onClick={() => { gameRef.current?.destroy(true); gameRef.current = null; navigate('/customize'); }} style={btnStyle}>Customize</button>
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
