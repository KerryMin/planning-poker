import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Room from './Room.jsx';

// Per-tab id that survives refresh, so the server can give us our seat back
// (vote, crown, away state) instead of treating us as a new person.
function getSessionId() {
  let sid = sessionStorage.getItem('pp-sid');
  if (!sid) {
    sid = crypto.randomUUID ? crypto.randomUUID() : `sid-${Math.random().toString(36).slice(2)}${Date.now()}`;
    sessionStorage.setItem('pp-sid', sid);
  }
  return sid;
}

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
  const sessionId = useMemo(getSessionId, []);
  const [joined, setJoined] = useState(null); // { code, room, myVote }
  const [error, setError] = useState('');

  const [name, setName] = useState(() => localStorage.getItem('pp-name') || '');
  const [emoji, setEmoji] = useState(() => localStorage.getItem('pp-emoji') || EMOJIS[0]);
  const [spectator, setSpectator] = useState(() => sessionStorage.getItem('pp-spectator') === '1');
  const [joinCode, setJoinCode] = useState(hashCode());
  const linkedCode = hashCode();
  const joinedRef = useRef(null);
  joinedRef.current = joined;

  useEffect(() => {
    const onHash = () => {
      if (!hashCode()) setJoined(null);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Reclaim our seat after any reconnect (server restart, network blip).
  useEffect(() => {
    const rejoin = () => {
      const j = joinedRef.current;
      if (j) {
        socket.emit(
          'join_room',
          {
            code: j.code,
            sessionId,
            name: localStorage.getItem('pp-name'),
            emoji: localStorage.getItem('pp-emoji'),
            role: sessionStorage.getItem('pp-spectator') === '1' ? 'spectator' : 'player',
          },
          (res) => {
            if (res?.ok) setJoined({ code: res.code, room: res.room, myVote: res.yourVote });
            else setJoined(null);
          }
        );
      }
    };
    socket.io.on('reconnect', rejoin);
    return () => socket.io.off('reconnect', rejoin);
  }, [socket, sessionId]);

  // After a page refresh, hop straight back into the room we were in.
  useEffect(() => {
    const code = hashCode();
    if (code && sessionStorage.getItem('pp-room') === code && (localStorage.getItem('pp-name') || '').trim()) {
      const doJoin = () => joinRoom(code);
      if (socket.connected) doJoin();
      else socket.once('connect', doJoin);
      return () => socket.off('connect', doJoin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveProfile() {
    localStorage.setItem('pp-name', name);
    localStorage.setItem('pp-emoji', emoji);
    sessionStorage.setItem('pp-spectator', spectator ? '1' : '0');
  }

  function profile() {
    return { name: name.trim(), emoji, role: spectator ? 'spectator' : 'player', sessionId };
  }

  function handleAck(res) {
    if (res?.ok) {
      setError('');
      setJoined({ code: res.code, room: res.room, myVote: res.yourVote });
      sessionStorage.setItem('pp-room', res.code);
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
        selfId={sessionId}
        initialRoom={joined.room}
        initialMyVote={joined.myVote ?? null}
        onLeave={() => {
          sessionStorage.removeItem('pp-room');
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
          <span className="logo-card">🎉</span> Point Party
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
