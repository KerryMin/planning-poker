import React, { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import Room from './Room.jsx';

const EMOJIS = [
  '🦊', '🐸', '🐙', '🦄', '🐝', '🦖',
  '🐢', '🦩', '🐨', '🐼', '🦉', '🐳',
  '🤖', '👻', '🎃', '🐲', '🦕', '🍄',
  '🌵', '🍕', '🌮', '🍩', '⭐', '🫠',
];

function hashCode() {
  const m = window.location.hash.match(/#\/room\/([A-Za-z0-9]+)/);
  return m ? m[1].toUpperCase() : '';
}

export default function App() {
  const socket = useMemo(() => io({ autoConnect: true }), []);
  const [joined, setJoined] = useState(null); // { code, room }
  const [error, setError] = useState('');

  const [name, setName] = useState(() => localStorage.getItem('pp-name') || '');
  const [emoji, setEmoji] = useState(() => localStorage.getItem('pp-emoji') || EMOJIS[0]);
  const [spectator, setSpectator] = useState(false);
  const [joinCode, setJoinCode] = useState(hashCode());
  const linkedCode = hashCode();

  useEffect(() => {
    const onHash = () => {
      if (!hashCode()) setJoined(null);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const onDisconnect = () => setJoined(null);
    socket.on('disconnect', onDisconnect);
    return () => socket.off('disconnect', onDisconnect);
  }, [socket]);

  function saveProfile() {
    localStorage.setItem('pp-name', name);
    localStorage.setItem('pp-emoji', emoji);
  }

  function profile() {
    return { name: name.trim(), emoji, role: spectator ? 'spectator' : 'player' };
  }

  function handleAck(res) {
    if (res?.ok) {
      setError('');
      setJoined({ code: res.code, room: res.room });
      window.location.hash = `#/room/${res.code}`;
    } else {
      setError(res?.error || 'Something went wrong.');
    }
  }

  function createRoom() {
    if (!name.trim()) return setError('Pick a name first!');
    saveProfile();
    socket.emit('create_room', profile(), handleAck);
  }

  function joinRoom(code) {
    if (!name.trim()) return setError('Pick a name first!');
    if (!code.trim()) return setError('Enter a room code.');
    saveProfile();
    socket.emit('join_room', { code: code.trim().toUpperCase(), ...profile() }, handleAck);
  }

  if (joined) {
    return (
      <Room
        socket={socket}
        initialRoom={joined.room}
        onLeave={() => {
          window.location.hash = '';
          window.location.reload();
        }}
      />
    );
  }

  return (
    <div className="home">
      <div className="home-card">
        <h1 className="logo">
          <span className="logo-card">🃏</span> Pointy Poker
        </h1>
        <p className="tagline">Planning poker for teams who argue about 3s and 5s.</p>

        <label className="field-label">Your name</label>
        <input
          className="text-input"
          value={name}
          maxLength={24}
          placeholder="e.g. Kerry"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (linkedCode || joinCode ? joinRoom(joinCode || linkedCode) : createRoom());
          }}
        />

        <label className="field-label">Pick your avatar</label>
        <div className="emoji-grid">
          {EMOJIS.map((e) => (
            <button
              key={e}
              className={`emoji-option ${emoji === e ? 'selected' : ''}`}
              onClick={() => setEmoji(e)}
            >
              {e}
            </button>
          ))}
        </div>

        <label className="spectator-toggle">
          <input type="checkbox" checked={spectator} onChange={(e) => setSpectator(e.target.checked)} />
          <span>
            Join as spectator <span className="dim">(watch &amp; react, no voting — perfect for PMs)</span>
          </span>
        </label>

        {error && <div className="error">{error}</div>}

        {linkedCode ? (
          <button className="btn btn-primary btn-big" onClick={() => joinRoom(linkedCode)}>
            Join room {linkedCode} →
          </button>
        ) : (
          <div className="home-actions">
            <button className="btn btn-primary btn-big" onClick={createRoom}>
              ✨ Create a room
            </button>
            <div className="join-row">
              <input
                className="text-input code-input"
                value={joinCode}
                maxLength={4}
                placeholder="CODE"
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && joinRoom(joinCode)}
              />
              <button className="btn btn-ghost" onClick={() => joinRoom(joinCode)}>
                Join room
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
