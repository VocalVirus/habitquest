import { useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { createGame } from '../game/index.js';

export default function GamePage() {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const { user, token } = useAuth();

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;
    gameRef.current = createGame(containerRef.current, { user, token });
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [user, token]);

  return <div ref={containerRef} id="game-container" style={{ width: '100vw', height: '100vh' }} />;
}
