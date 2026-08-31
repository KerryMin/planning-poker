// Test bot: joins a room and always votes the given value when a round is open.
// Usage: node scripts/bot.js <ROOM> <name> <emoji> <vote|spectator>
import { io } from 'socket.io-client';

const [, , code, name = 'Bot', emoji = '🤖', vote = '13'] = process.argv;
const socket = io('http://localhost:3001');
const spectator = vote === 'spectator';
let pending = null;

socket.on('connect', () => {
  socket.emit(
    'join_room',
    { code, name, emoji, role: spectator ? 'spectator' : 'player' },
    (res) => console.log('join:', JSON.stringify(res?.ok ? { ok: true } : res))
  );
});

socket.on('room_update', (room) => {
  if (spectator) return;
  const me = room.users.find((u) => u.id === socket.id);
  if (room.state === 'voting' && me && !me.hasVoted && !me.away) {
    if (!pending) {
      pending = setTimeout(() => {
        pending = null;
        socket.emit('vote', vote);
      }, 1200);
    }
  } else if (pending) {
    clearTimeout(pending);
    pending = null;
  }
});

setTimeout(() => process.exit(0), 120000);
