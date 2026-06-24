import { useState, useEffect, useRef } from 'react';

const MAX_MESSAGES = 100;
const VISIBLE_HEIGHT = 160;

export default function ChatOverlay({ game }) {
  const [messages, setMessages] = useState([]);
  const inputRef = useRef(null);
  const logRef   = useRef(null);
  const gameRef  = useRef(game);
  useEffect(() => { gameRef.current = game; }, [game]);

  // Incoming messages from Phaser socket bridge
  useEffect(() => {
    if (!game) return;
    const onReceived = (msg) => {
      setMessages((prev) => [...prev.slice(-(MAX_MESSAGES - 1)), msg]);
    };
    game.events.on('chat:received', onReceived);
    return () => game.events.off('chat:received', onReceived);
  }, [game]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  // Global Enter → focus input when it isn't already focused
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function send() {
    const text = inputRef.current?.value.trim();
    if (!text) { inputRef.current?.blur(); return; }
    gameRef.current?.events.emit('chat:send', { text });
    if (inputRef.current) inputRef.current.value = '';
  }

  // nativeEvent.stopImmediatePropagation() fires at React's root div (bubble phase),
  // which sits below window in the DOM — Phaser's window listener never sees the event.
  function onKeyDown(e) {
    e.nativeEvent.stopImmediatePropagation();
    if (e.key === 'Escape') { e.preventDefault(); inputRef.current?.blur(); }
    // Enter is handled by the <form> onSubmit — no extra logic needed here
  }

  function onFocus() { gameRef.current?.events.emit('chat:active', true); }
  function onBlur()  { gameRef.current?.events.emit('chat:active', false); }

  if (!game) return null;

  return (
    <div style={containerStyle}>
      <div ref={logRef} style={logStyle}>
        {messages.length === 0 ? (
          <span style={{ color: '#555', fontSize: '11px' }}>No messages yet</span>
        ) : (
          messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 3, lineHeight: 1.3 }}>
              <span style={{ color: '#ffd700' }}>[{m.username}]</span>{' '}
              <span style={{ color: '#e0e0e0' }}>{m.text}</span>
            </div>
          ))
        )}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} style={inputRowStyle}>
        <span style={{ color: '#ffd700', marginRight: 4 }}>{'>'}</span>
        <input
          ref={inputRef}
          onKeyDown={onKeyDown}
          onKeyUp={(e) => e.nativeEvent.stopImmediatePropagation()}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="Press Enter to chat..."
          maxLength={200}
          style={inputStyle}
        />
      </form>
    </div>
  );
}

const containerStyle = {
  position: 'fixed',
  bottom: 16,
  left: 16,
  width: 340,
  zIndex: 20,
  fontFamily: 'monospace',
  fontSize: '12px',
  userSelect: 'none',
};

const logStyle = {
  height: VISIBLE_HEIGHT,
  overflowY: 'auto',
  background: 'rgba(0,0,0,0.6)',
  border: '1px solid #333',
  borderBottom: 'none',
  padding: '8px 10px',
  scrollbarWidth: 'thin',
  scrollbarColor: '#444 transparent',
};

const inputRowStyle = {
  display: 'flex',
  alignItems: 'center',
  background: 'rgba(0,0,0,0.75)',
  border: '1px solid #444',
  padding: '5px 8px',
};

const inputStyle = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: '#e0e0e0',
  fontFamily: 'monospace',
  fontSize: '12px',
  caretColor: '#ffd700',
};
