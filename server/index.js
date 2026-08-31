import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '../client/dist');
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// ---------------------------------------------------------------------------
// Room state
// ---------------------------------------------------------------------------
const rooms = new Map();
const CELEBRATIONS = ['party', 'disco', 'fanfare'];
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function makeCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function makeRoom(code) {
  return {
    code,
    hostId: null,
    state: 'voting', // 'voting' | 'revealed'
    autoReveal: true,
    celebrationMode: 'cycle', // 'cycle' | 'party' | 'disco' | 'fanfare' | 'off'
    celebrationIndex: 0,
    users: new Map(), // socketId -> user
    queue: [], // { id, text, url, done }
    currentTicketId: null,
    history: [], // { ticket, url, average, votes, consensus, at }
    results: null,
    ticketSeq: 1,
    emptyTimer: null,
  };
}

function activePlayers(room) {
  return [...room.users.values()].filter((u) => u.role === 'player' && !u.away && u.connected);
}

function currentTicket(room) {
  return room.queue.find((t) => t.id === room.currentTicketId) || null;
}

function computeResults(room) {
  const voters = activePlayers(room).filter((u) => u.vote != null);
  const groups = new Map(); // voteValue -> [userIds]
  for (const u of voters) {
    if (!groups.has(u.vote)) groups.set(u.vote, []);
    groups.get(u.vote).push(u.id);
  }
  const sorted = [...groups.entries()].sort((a, b) => {
    const na = parseFloat(a[0]);
    const nb = parseFloat(b[0]);
    const aNum = !Number.isNaN(na);
    const bNum = !Number.isNaN(nb);
    if (aNum && bNum) return na - nb;
    if (aNum) return -1;
    if (bNum) return 1;
    return String(a[0]).localeCompare(String(b[0]));
  });
  const numericVotes = voters.map((u) => parseFloat(u.vote)).filter((n) => !Number.isNaN(n));
  const average = numericVotes.length
    ? Math.round((numericVotes.reduce((s, n) => s + n, 0) / numericVotes.length) * 10) / 10
    : null;

  const consensus = voters.length >= 2 && sorted.length === 1;
  let celebration = null;
  if (consensus && room.celebrationMode !== 'off') {
    celebration =
      room.celebrationMode === 'cycle'
        ? CELEBRATIONS[room.celebrationIndex++ % CELEBRATIONS.length]
        : room.celebrationMode;
  }

  // Lone dissenter: 3+ voters, exactly one group of size 1, all others identical
  let dissenterId = null;
  if (voters.length >= 3 && sorted.length === 2) {
    const solo = sorted.find(([, ids]) => ids.length === 1);
    const rest = sorted.find(([, ids]) => ids.length === voters.length - 1);
    if (solo && rest) dissenterId = solo[1][0];
  }

  return {
    groups: sorted.map(([value, ids]) => ({ value, userIds: ids })),
    average,
    consensus,
    celebration,
    dissenterId,
    votedCount: voters.length,
  };
}

function serializeRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    state: room.state,
    autoReveal: room.autoReveal,
    celebrationMode: room.celebrationMode,
    users: [...room.users.values()].map((u) => ({
      id: u.id,
      name: u.name,
      emoji: u.emoji,
      role: u.role,
      away: u.away,
      connected: u.connected,
      hasVoted: u.vote != null,
      vote: room.state === 'revealed' ? u.vote : null,
    })),
    queue: room.queue,
    currentTicketId: room.currentTicketId,
    history: room.history,
    results: room.state === 'revealed' ? room.results : null,
  };
}

function broadcast(room) {
  io.to(room.code).emit('room_update', serializeRoom(room));
}

function reveal(room) {
  if (room.state === 'revealed') return;
  room.state = 'revealed';
  room.results = computeResults(room);
  broadcast(room);
}

function maybeAutoReveal(room) {
  if (!room.autoReveal || room.state !== 'voting') return;
  const players = activePlayers(room);
  if (players.length >= 2 && players.every((u) => u.vote != null)) reveal(room);
}

function resetVotes(room) {
  for (const u of room.users.values()) u.vote = null;
  room.state = 'voting';
  room.results = null;
}

function recordHistory(room) {
  if (room.state !== 'revealed' || !room.results || !room.results.votedCount) return;
  const ticket = currentTicket(room);
  room.history.unshift({
    ticket: ticket ? ticket.text : null,
    url: ticket ? ticket.url : null,
    average: room.results.average,
    consensus: room.results.consensus,
    groups: room.results.groups.map((g) => ({
      value: g.value,
      names: g.userIds.map((id) => room.users.get(id)?.name).filter(Boolean),
    })),
    at: Date.now(),
  });
  if (room.history.length > 50) room.history.length = 50;
}

function pickNewHost(room) {
  const users = [...room.users.values()];
  const next =
    users.find((u) => u.role === 'player' && u.connected) ||
    users.find((u) => u.connected) ||
    users[0];
  room.hostId = next ? next.id : null;
}

function parseTickets(text) {
  return String(text)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 100)
    .map((line) => {
      const isUrl = /^https?:\/\//i.test(line);
      return { text: line.slice(0, 300), url: isUrl ? line.slice(0, 500) : null };
    });
}

// ---------------------------------------------------------------------------
// Socket handlers
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
  let room = null;
  let user = null;

  const isHost = () => room && user && room.hostId === user.id;

  function joinRoomAs(r, { name, emoji, role, sessionId }) {
    room = r;
    if (room.emptyTimer) {
      clearTimeout(room.emptyTimer);
      room.emptyTimer = null;
    }
    // A stable per-tab sessionId lets a refresh or network blip reclaim the
    // same seat (vote, crown, away state). Falls back to the socket id.
    const sid = String(sessionId || socket.id).slice(0, 64);
    const existing = room.users.get(sid);
    if (existing) {
      if (existing.removeTimer) {
        clearTimeout(existing.removeTimer);
        existing.removeTimer = null;
      }
      existing.socketId = socket.id;
      existing.connected = true;
      if (name) existing.name = String(name).slice(0, 24);
      if (emoji) existing.emoji = String(emoji).slice(0, 8);
      user = existing;
    } else {
      user = {
        id: sid,
        socketId: socket.id,
        name: String(name || 'Anon').slice(0, 24),
        emoji: String(emoji || '🙂').slice(0, 8),
        role: role === 'spectator' ? 'spectator' : 'player',
        away: false,
        vote: null,
        connected: true,
        removeTimer: null,
      };
      room.users.set(sid, user);
    }
    if (!room.hostId) room.hostId = user.id;
    socket.join(room.code);
    broadcast(room);
  }

  const joinAck = (cb) =>
    cb?.({ ok: true, code: room.code, room: serializeRoom(room), yourId: user.id, yourVote: user.vote });

  socket.on('create_room', (profile, cb) => {
    const r = makeRoom(makeCode());
    rooms.set(r.code, r);
    joinRoomAs(r, profile || {});
    joinAck(cb);
  });

  socket.on('join_room', ({ code, ...profile } = {}, cb) => {
    const r = rooms.get(String(code || '').toUpperCase().trim());
    if (!r) return cb?.({ ok: false, error: 'Room not found — check the code!' });
    joinRoomAs(r, profile);
    joinAck(cb);
  });

  socket.on('vote', (value) => {
    if (!room || !user || room.state !== 'voting') return;
    if (user.role !== 'player' || user.away) return;
    const v = value == null ? null : String(value).slice(0, 20);
    user.vote = user.vote === v ? null : v; // clicking same card un-votes
    broadcast(room);
    maybeAutoReveal(room);
  });

  socket.on('reveal', () => {
    if (isHost()) reveal(room);
  });

  socket.on('new_round', () => {
    if (!isHost()) return;
    recordHistory(room);
    resetVotes(room);
    broadcast(room);
  });

  socket.on('next_ticket', () => {
    if (!isHost()) return;
    recordHistory(room);
    const cur = currentTicket(room);
    if (cur) cur.done = true;
    const next = room.queue.find((t) => !t.done);
    room.currentTicketId = next ? next.id : null;
    resetVotes(room);
    broadcast(room);
  });

  socket.on('add_tickets', (text) => {
    if (!isHost()) return;
    for (const t of parseTickets(text)) {
      room.queue.push({ id: room.ticketSeq++, text: t.text, url: t.url, done: false });
    }
    if (!room.currentTicketId) {
      const next = room.queue.find((t) => !t.done);
      room.currentTicketId = next ? next.id : null;
    }
    broadcast(room);
  });

  socket.on('remove_ticket', (id) => {
    if (!isHost()) return;
    room.queue = room.queue.filter((t) => t.id !== id);
    if (room.currentTicketId === id) {
      const next = room.queue.find((t) => !t.done);
      room.currentTicketId = next ? next.id : null;
    }
    broadcast(room);
  });

  socket.on('set_current_ticket', (id) => {
    if (!isHost()) return;
    const t = room.queue.find((q) => q.id === id);
    if (t) {
      t.done = false;
      room.currentTicketId = t.id;
      broadcast(room);
    }
  });

  socket.on('set_away', (away) => {
    if (!room || !user) return;
    user.away = !!away;
    if (user.away) user.vote = null;
    broadcast(room);
    maybeAutoReveal(room);
  });

  socket.on('set_auto_reveal', (val) => {
    if (!isHost()) return;
    room.autoReveal = !!val;
    broadcast(room);
    maybeAutoReveal(room);
  });

  socket.on('set_celebration', (mode) => {
    if (!isHost()) return;
    if (['cycle', ...CELEBRATIONS, 'off'].includes(mode)) {
      room.celebrationMode = mode;
      broadcast(room);
    }
  });

  socket.on('nudge', () => {
    if (!isHost() || room.state !== 'voting') return;
    for (const u of activePlayers(room)) {
      if (u.vote == null && u.id !== user.id) io.to(u.socketId).emit('nudged');
    }
  });

  socket.on('transfer_host', (targetId) => {
    if (!isHost()) return;
    const target = room.users.get(targetId);
    if (target) {
      room.hostId = target.id;
      broadcast(room);
    }
  });

  socket.on('reaction', (emoji) => {
    if (!room || !user) return;
    const e = String(emoji || '').slice(0, 8);
    if (e) io.to(room.code).emit('reaction', { emoji: e, name: user.name });
  });

  socket.on('disconnect', () => {
    if (!room || !user) return;
    // A newer connection already reclaimed this seat; this socket is stale.
    if (user.socketId !== socket.id) return;
    const r = room;
    const u = user;
    u.connected = false;
    // 60s grace: a refresh or blip reclaims the seat with vote + crown intact.
    u.removeTimer = setTimeout(() => {
      r.users.delete(u.id);
      if (r.hostId === u.id) pickNewHost(r);
      if (r.users.size === 0) {
        r.emptyTimer = setTimeout(() => {
          if (r.users.size === 0) rooms.delete(r.code);
        }, 10 * 60 * 1000);
      } else {
        broadcast(r);
        maybeAutoReveal(r);
      }
    }, 60 * 1000);
    broadcast(r);
    room = null;
    user = null;
  });
});

httpServer.listen(PORT, () => {
  console.log(`🃏 Planning poker server on http://localhost:${PORT}`);
});
