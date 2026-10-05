// Seasonal theming. Halloween turns itself on for October and off Nov 1;
// ?theme=halloween / ?theme=none overrides for testing or killjoys.
export function halloweenSeason() {
  const override = new URLSearchParams(window.location.search).get('theme');
  if (override === 'halloween') return true;
  if (override === 'none') return false;
  return new Date().getMonth() === 9; // October
}

const FAVICON = (emoji) =>
  `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>${emoji}</text></svg>`;

export function applyDocumentTheme(halloween) {
  document.documentElement.dataset.theme = halloween ? 'halloween' : '';
  document.title = halloween ? 'Point Party 🎃' : 'Point Party 🎉';
  const icon = document.querySelector('link[rel="icon"]');
  if (icon) icon.href = FAVICON(halloween ? '🎃' : '🎉');
}

export const HALLOWEEN_EMOJIS = [
  '🎃', '👻', '🧛', '🧟', '🧙', '🦇',
  '🕷️', '🕸️', '🐈‍⬛', '💀', '👹', '🤡',
  '😈', '🧌', '🧞', '⚰️', '🍬', '🌕',
  '🔮', '🪦', '🦉', '🐺', '🧿', '☠️',
];

export const HALLOWEEN_REACTIONS = ['🎃', '👻', '😱', '🕷️', '🍬', '🦇', '💀', '🔥'];
