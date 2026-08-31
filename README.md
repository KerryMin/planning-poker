# 🎉 Point Party

Planning poker for remote agile teams — dark mode, emoji avatars, and celebrations when the team actually agrees.

## Features

- **Create / join rooms** with a 4-letter code or a shareable link
- **Emoji avatars** — pick your fighter
- **Spectator mode** for PMs and visitors (watch + emoji reactions, no voting)
- **Fibonacci deck** (1, 2, 3, 5, 8, 13) plus 🤷 can't-decide and ✏️ write-in cards
- **Auto-reveal** when everyone active has voted (moderator can toggle or reveal manually)
- **Grouped results** — votes grouped by value in rows, least to greatest, with the average (and closest Fibonacci)
- **Consensus celebrations** — party lights 🎉, disco dance 🪩, or trumpet fanfare 🎺 (cycles by default, moderator can pick)
- **Lone dissenter stare-down** — vote differently from everyone else and the room stares 👀 (womp womp 🎺)
- **Ticket queue** — moderator pastes ticket URLs/titles, one per line; "Next ticket" advances after each round
- **Round history** — every finished round logged with average + votes, copyable as markdown
- **Away mode** — step away 💤 and the room won't wait on your vote
- **Vote nudge** — moderator pokes anyone dragging their feet
- **Refresh-proof seats** — a page refresh or network blip reclaims your seat (vote, away state, and the moderator crown) within a 60-second grace window; dropped players show as "📡 reconnecting…"
- **Transfer moderator** — hover another player's card and click the 👑
- **Moderator doesn't vote** — the host facilitates (🎙️ on their card); handing off the crown restores their deck and clears the new moderator's pending ballot
- All sounds synthesized in-browser (Web Audio) — mute toggle included

## Run it

```bash
npm install
npm run dev        # dev: client on http://localhost:5173, server on :3001
```

Production:

```bash
npm run build
npm start          # serves everything on http://localhost:3001 (set PORT to change)
```

Rooms live in server memory; an empty room is kept for 10 minutes (so a refresh doesn't kill it) and then cleaned up.

## Deploying for your team

Any Node host works (Render, Fly.io, Railway…): build command `npm install && npm run build`, start command `npm start`. WebSockets must be allowed (they are by default on those hosts).
