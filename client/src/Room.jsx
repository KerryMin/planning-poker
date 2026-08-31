import React, { useEffect, useMemo, useRef, useState } from 'react';
import { sounds, isMuted, setMuted } from './sounds.js';

const DECK = ['1', '2', '3', '5', '8', '13'];
const FIB = [1, 2, 3, 5, 8, 13];
const REACTIONS = ['👏', '🔥', '🤔', '😂', '❤️', '👀', '🎉', '☕'];
const CELEB_LABELS = {
  cycle: '🔀 Surprise me (cycle)',
  party: '🎉 Party lights',
  disco: '🪩 Disco dance',
  fanfare: '🎺 Trumpet fanfare',
  off: '🚫 No celebrations',
};

function closestFib(avg) {
  if (avg == null) return null;
  return FIB.reduce((best, f) => (Math.abs(f - avg) < Math.abs(best - avg) ? f : best), FIB[0]);
}

function ticketLabel(t) {
  if (!t) return null;
  if (t.url) {
    try {
      const u = new URL(t.url);
      const parts = u.pathname.split('/').filter(Boolean);
      const tail = parts.slice(-2).join('/');
      return tail ? `${u.hostname.replace('www.', '')}/…/${tail}` : u.hostname;
    } catch {
      return t.text;
    }
  }
  return t.text;
}

function Confetti({ count = 90 }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        dur: 2.2 + Math.random() * 1.8,
        color: ['#f472b6', '#a78bfa', '#34d399', '#fbbf24', '#38bdf8', '#fb7185'][i % 6],
        spin: Math.random() > 0.5 ? 1 : -1,
        size: 6 + Math.random() * 8,
      })),
    [count]
  );
  return (
    <div className="confetti-layer">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.5,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            '--spin': p.spin,
          }}
        />
      ))}
    </div>
  );
}

function CelebrationOverlay({ type }) {
  if (!type) return null;
  return (
    <div className={`celebration celebration-${type}`}>
      {type === 'party' && (
        <>
          <div className="party-lights" />
          <Confetti />
          <div className="celebration-banner">🎉 CONSENSUS! 🎉</div>
        </>
      )}
      {type === 'disco' && (
        <>
          <div className="disco-beams" />
          <div className="disco-ball">🪩</div>
          <div className="celebration-banner">💃 EVERYBODY DANCE! 🕺</div>
        </>
      )}
      {type === 'fanfare' && (
        <>
          <div className="fanfare-rays" />
          <Confetti count={50} />
          <div className="celebration-banner fanfare-banner">🎺 CONSENSUS! 🎺</div>
        </>
      )}
    </div>
  );
}

export default function Room({ socket, selfId, initialRoom, initialMyVote = null, onLeave }) {
  const [room, setRoom] = useState(initialRoom);
  const [myVote, setMyVote] = useState(initialMyVote);
  const [celebration, setCelebration] = useState(null);
  const [staring, setStaring] = useState(false);
  const [reactions, setReactions] = useState([]);
  const [toast, setToast] = useState(null);
  const [wiggle, setWiggle] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const [tab, setTab] = useState('queue');
  const [writeInOpen, setWriteInOpen] = useState(false);
  const [writeInText, setWriteInText] = useState('');
  const [queueText, setQueueText] = useState('');
  const [copied, setCopied] = useState(false);
  const prevState = useRef(initialRoom.state);
  const reactionSeq = useRef(0);

  const me = room.users.find((u) => u.id === selfId);
  const isHost = room.hostId === selfId;
  const isPlayer = me?.role === 'player';
  const current = room.queue.find((t) => t.id === room.currentTicketId) || null;
  const players = room.users.filter((u) => u.role === 'player');
  const spectators = room.users.filter((u) => u.role === 'spectator');
  const voterPool = players.filter((u) => !u.away && u.connected !== false && u.id !== room.hostId);
  const activeCount = voterPool.length;
  const votedCount = voterPool.filter((u) => u.hasVoted).length;

  // If the crown lands on us mid-round the server drops our ballot; clear the
  // local card highlight so it doesn't lie when the crown moves on.
  useEffect(() => {
    if (isHost) setMyVote(null);
  }, [isHost]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  useEffect(() => {
    function onUpdate(r) {
      // Fire effects on the voting -> revealed transition
      if (prevState.current === 'voting' && r.state === 'revealed' && r.results) {
        sounds.reveal();
        if (r.results.celebration) {
          setCelebration(r.results.celebration);
          setTimeout(() => sounds[r.results.celebration]?.(), 350);
          setTimeout(() => setCelebration(null), 5000);
        } else if (r.results.dissenterId) {
          setStaring(true);
          setTimeout(() => sounds.womp(), 400);
          setTimeout(() => setStaring(false), 5000);
        }
      }
      if (r.state === 'voting' && prevState.current === 'revealed') {
        setMyVote(null);
        setCelebration(null);
        setStaring(false);
      }
      prevState.current = r.state;
      setRoom(r);
    }
    function onNudged() {
      sounds.nudge();
      setWiggle(true);
      showToast('👉 Psst… the team is waiting on your vote!');
      setTimeout(() => setWiggle(false), 1200);
    }
    function onReaction({ emoji, name }) {
      const id = reactionSeq.current++;
      const x = 10 + Math.random() * 80;
      setReactions((rs) => [...rs, { id, emoji, name, x }]);
      setTimeout(() => setReactions((rs) => rs.filter((r) => r.id !== id)), 3200);
    }
    socket.on('room_update', onUpdate);
    socket.on('nudged', onNudged);
    socket.on('reaction', onReaction);
    return () => {
      socket.off('room_update', onUpdate);
      socket.off('nudged', onNudged);
      socket.off('reaction', onReaction);
    };
  }, [socket]);

  function castVote(value) {
    if (room.state !== 'voting' || !isPlayer || me?.away) return;
    sounds.pop();
    setMyVote((prev) => (prev === value ? null : value));
    socket.emit('vote', value);
  }

  function submitWriteIn() {
    const v = writeInText.trim().slice(0, 20);
    if (v) {
      castVote(v);
      setWriteInOpen(false);
      setWriteInText('');
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function copyHistory() {
    const lines = room.history.map((h) => {
      const groups = h.groups.map((g) => `${g.value}: ${g.names.join(', ')}`).join(' | ');
      return `- ${h.ticket || '(no ticket)'} — avg ${h.average ?? '—'}${h.consensus ? ' 🎯 consensus' : ''} — ${groups}`;
    });
    navigator.clipboard.writeText(lines.join('\n'));
    showToast('📋 History copied as markdown!');
  }

  const results = room.results;
  const userById = (id) => room.users.find((u) => u.id === id);
  const dancing = celebration === 'disco';

  return (
    <div className={`room ${wiggle ? 'wiggle' : ''}`}>
      <CelebrationOverlay type={celebration} />

      {/* floating reactions */}
      <div className="reactions-layer">
        {reactions.map((r) => (
          <div key={r.id} className="floating-reaction" style={{ left: `${r.x}%` }}>
            <span className="floating-emoji">{r.emoji}</span>
            <span className="floating-name">{r.name}</span>
          </div>
        ))}
      </div>

      {toast && <div className="toast">{toast}</div>}

      {/* ---------- header ---------- */}
      <header className="room-header">
        <div className="room-title">
          <span className="logo-card">🃏</span>
          <span className="room-name">Pointy Poker</span>
          <button className="room-code" onClick={copyLink} title="Copy invite link">
            {room.code} {copied ? '✅' : '🔗'}
          </button>
        </div>
        <div className="header-actions">
          {me && (
            <button
              className={`btn btn-ghost btn-sm ${me.away ? 'active' : ''}`}
              onClick={() => socket.emit('set_away', !me.away)}
            >
              {me.away ? '☕ I’m back!' : '💤 Step away'}
            </button>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setMuted(!muted);
              setMutedState(!muted);
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onLeave}>
            🚪 Leave
          </button>
        </div>
      </header>

      <div className="room-body">
        <main className="table-area">
          {/* ---------- current ticket ---------- */}
          <div className="ticket-banner">
            {current ? (
              <>
                <span className="ticket-label">Now refining:</span>
                {current.url ? (
                  <a href={current.url} target="_blank" rel="noreferrer" className="ticket-link">
                    {ticketLabel(current)} ↗
                  </a>
                ) : (
                  <span className="ticket-text">{current.text}</span>
                )}
              </>
            ) : (
              <span className="ticket-label dim">
                {isHost ? 'Add tickets to the queue → or just start voting!' : 'Waiting for the moderator…'}
              </span>
            )}
            {room.state === 'voting' && (
              <span className="vote-progress">
                🗳️ {votedCount}/{activeCount} voted
              </span>
            )}
          </div>

          {/* ---------- participants ---------- */}
          <div className={`players-grid ${dancing ? 'dancing' : ''}`}>
            {players.map((u) => {
              const isDissenter = staring && results?.dissenterId === u.id;
              const isStarer = staring && results?.dissenterId && results.dissenterId !== u.id;
              return (
                <div
                  key={u.id}
                  className={[
                    'player-card',
                    u.away ? 'away' : '',
                    u.connected === false ? 'offline' : '',
                    u.id === selfId ? 'is-me' : '',
                    isDissenter ? 'dissenter' : '',
                    isStarer ? 'starer' : '',
                  ].join(' ')}
                >
                  {room.hostId === u.id && <span className="crown">👑</span>}
                  {isHost && u.id !== selfId && (
                    <button
                      className="make-host"
                      title={`Make ${u.name} the moderator`}
                      onClick={() => socket.emit('transfer_host', u.id)}
                    >
                      👑
                    </button>
                  )}
                  {isStarer && <span className="stare-eyes">👀</span>}
                  <div className="player-avatar">{u.away ? '😴' : u.emoji}</div>
                  <div className="player-name">
                    {u.name}
                    {u.id === selfId ? ' (you)' : ''}
                  </div>
                  <div className="player-vote">
                    {u.connected === false ? (
                      <span className="vote-chip offline-chip">📡 reconnecting…</span>
                    ) : u.away ? (
                      <span className="vote-chip zzz">💤</span>
                    ) : u.id === room.hostId ? (
                      <span className="vote-chip modchip" title="Moderator — doesn't vote">
                        🎙️
                      </span>
                    ) : room.state === 'revealed' ? (
                      u.vote != null ? (
                        <span className={`vote-chip revealed ${isDissenter ? 'womp' : ''}`}>{u.vote}</span>
                      ) : (
                        <span className="vote-chip empty">—</span>
                      )
                    ) : u.hasVoted ? (
                      <span className="vote-chip facedown">🂠</span>
                    ) : (
                      <span className="vote-chip thinking">…</span>
                    )}
                  </div>
                  {isDissenter && <div className="womp-label">womp womp 🎺</div>}
                </div>
              );
            })}
          </div>

          {spectators.length > 0 && (
            <div className="spectators-row">
              <span className="dim">👁 Watching:</span>
              {spectators.map((u) => (
                <span key={u.id} className={`spectator-chip ${u.id === selfId ? 'is-me' : ''}`}>
                  {u.emoji} {u.name}
                </span>
              ))}
            </div>
          )}

          {/* ---------- results ---------- */}
          {room.state === 'revealed' && results && (
            <div className="results">
              {results.consensus && <div className="consensus-tag">🎯 Full consensus!</div>}
              {results.average != null && (
                <div className="average-row">
                  <span className="average-big">
                    Average: <b>{results.average}</b>
                  </span>
                  {closestFib(results.average) !== results.average && (
                    <span className="fib-hint">closest Fibonacci: {closestFib(results.average)}</span>
                  )}
                </div>
              )}
              <div className="vote-groups">
                {results.groups.map((g) => (
                  <div key={g.value} className="vote-group-row">
                    <span className="group-value">{g.value}</span>
                    <span className="group-voters">
                      {g.userIds.map((id) => {
                        const u = userById(id);
                        return u ? (
                          <span key={id} className="group-voter">
                            <span className="group-voter-emoji">{u.emoji}</span> {u.name}
                          </span>
                        ) : null;
                      })}
                    </span>
                  </div>
                ))}
                {results.groups.length === 0 && <div className="dim">Nobody voted 🫥</div>}
              </div>
            </div>
          )}

          {/* ---------- moderator bar ---------- */}
          {isHost && (
            <div className="mod-bar">
              <span className="mod-label">👑 Moderator</span>
              {room.state === 'voting' ? (
                <>
                  <button className="btn btn-primary btn-sm" onClick={() => socket.emit('reveal')}>
                    👁 Reveal now
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => socket.emit('nudge')}>
                    👉 Nudge non-voters
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-primary btn-sm" onClick={() => socket.emit('new_round')}>
                    🔄 Re-vote
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => socket.emit('next_ticket')}>
                    ⏭ Next ticket
                  </button>
                </>
              )}
              <label className="mod-toggle">
                <input
                  type="checkbox"
                  checked={room.autoReveal}
                  onChange={(e) => socket.emit('set_auto_reveal', e.target.checked)}
                />
                Auto-reveal
              </label>
              <select
                className="celebration-select"
                value={room.celebrationMode}
                onChange={(e) => socket.emit('set_celebration', e.target.value)}
              >
                {Object.entries(CELEB_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ---------- deck ---------- */}
          {isPlayer && isHost && !me?.away && room.state === 'voting' && (
            <div className="away-note">🎙️ You’re moderating this round — no vote needed from you.</div>
          )}
          {isPlayer && !isHost && !me?.away && room.state === 'voting' && (
            <div className="deck-wrap">
              {writeInOpen && (
                <div className="writein-popover">
                  <input
                    autoFocus
                    className="text-input"
                    maxLength={20}
                    placeholder="e.g. “split it” or 4.5"
                    value={writeInText}
                    onChange={(e) => setWriteInText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitWriteIn();
                      if (e.key === 'Escape') setWriteInOpen(false);
                    }}
                  />
                  <button className="btn btn-primary btn-sm" onClick={submitWriteIn}>
                    Vote
                  </button>
                </div>
              )}
              <div className="deck">
                {DECK.map((v) => (
                  <button
                    key={v}
                    className={`poker-card ${myVote === v ? 'selected' : ''}`}
                    onClick={() => castVote(v)}
                  >
                    {v}
                  </button>
                ))}
                <button
                  className={`poker-card special ${myVote === '?' ? 'selected' : ''}`}
                  title="Can't decide"
                  onClick={() => castVote('?')}
                >
                  🤷
                </button>
                <button
                  className={`poker-card special ${myVote && !DECK.includes(myVote) && myVote !== '?' ? 'selected' : ''}`}
                  title="Write in your own"
                  onClick={() => setWriteInOpen((o) => !o)}
                >
                  ✏️
                </button>
              </div>
            </div>
          )}
          {isPlayer && me?.away && (
            <div className="away-note">😴 You’re away — votes aren’t waiting on you. Tap “I’m back!” up top to rejoin.</div>
          )}

          {/* ---------- reactions bar ---------- */}
          <div className="reaction-bar">
            {REACTIONS.map((e) => (
              <button key={e} className="reaction-btn" onClick={() => socket.emit('reaction', e)}>
                {e}
              </button>
            ))}
          </div>
        </main>

        {/* ---------- sidebar ---------- */}
        <aside className="sidebar">
          <div className="tabs">
            <button className={`tab ${tab === 'queue' ? 'active' : ''}`} onClick={() => setTab('queue')}>
              📋 Queue ({room.queue.filter((t) => !t.done).length})
            </button>
            <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
              🕰 History ({room.history.length})
            </button>
          </div>

          {tab === 'queue' && (
            <div className="panel">
              {isHost && (
                <div className="queue-add">
                  <textarea
                    className="text-input queue-textarea"
                    rows={3}
                    placeholder={'Paste ticket URLs or titles,\none per line'}
                    value={queueText}
                    onChange={(e) => setQueueText(e.target.value)}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      if (queueText.trim()) {
                        socket.emit('add_tickets', queueText);
                        setQueueText('');
                      }
                    }}
                  >
                    ➕ Add to queue
                  </button>
                </div>
              )}
              <ul className="queue-list">
                {room.queue.map((t) => (
                  <li
                    key={t.id}
                    className={[
                      'queue-item',
                      t.id === room.currentTicketId ? 'current' : '',
                      t.done ? 'done' : '',
                    ].join(' ')}
                  >
                    <button
                      className="queue-item-text"
                      disabled={!isHost}
                      title={isHost ? 'Make this the current ticket' : t.text}
                      onClick={() => socket.emit('set_current_ticket', t.id)}
                    >
                      {t.id === room.currentTicketId ? '▶ ' : t.done ? '✅ ' : ''}
                      {ticketLabel(t)}
                    </button>
                    {t.url && (
                      <a className="queue-open" href={t.url} target="_blank" rel="noreferrer" title="Open ticket">
                        ↗
                      </a>
                    )}
                    {isHost && (
                      <button className="queue-remove" onClick={() => socket.emit('remove_ticket', t.id)}>
                        ✕
                      </button>
                    )}
                  </li>
                ))}
                {room.queue.length === 0 && <li className="dim empty-note">Queue is empty.</li>}
              </ul>
            </div>
          )}

          {tab === 'history' && (
            <div className="panel">
              {room.history.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={copyHistory}>
                  📋 Copy all as markdown
                </button>
              )}
              <ul className="history-list">
                {room.history.map((h, i) => (
                  <li key={i} className="history-item">
                    <div className="history-ticket">
                      {h.url ? (
                        <a href={h.url} target="_blank" rel="noreferrer">
                          {h.ticket} ↗
                        </a>
                      ) : (
                        h.ticket || <span className="dim">(no ticket)</span>
                      )}
                    </div>
                    <div className="history-meta">
                      {h.average != null && <span className="history-avg">avg {h.average}</span>}
                      {h.consensus && <span className="history-consensus">🎯 consensus</span>}
                    </div>
                    <div className="history-groups dim">
                      {h.groups.map((g) => `${g.value} (${g.names.join(', ')})`).join(' · ')}
                    </div>
                  </li>
                ))}
                {room.history.length === 0 && <li className="dim empty-note">No rounds finished yet.</li>}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
