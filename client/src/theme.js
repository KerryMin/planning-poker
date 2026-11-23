// Seasonal theming. Each season turns itself on for its month and off after;
// ?theme=halloween / ?theme=thanksgiving / ?theme=none overrides for testing.
export function currentSeason() {
  const override = new URLSearchParams(window.location.search).get('theme');
  if (override === 'none') return null;
  if (override && THEMES[override]) return override;
  const m = new Date().getMonth();
  if (m === 9) return 'halloween'; // October
  if (m === 10) return 'thanksgiving'; // November
  return null;
}

export const THEMES = {
  halloween: {
    icon: '🎃',
    tagline: 'Planning poker that’s scary accurate. 🦇',
    toggleLabel: '🎃 Spooky mode',
    emojis: [
      '🎃', '👻', '🧛', '🧟', '🧙', '🦇',
      '🕷️', '🕸️', '🐈‍⬛', '💀', '👹', '🤡',
      '😈', '🧌', '🧞', '⚰️', '🍬', '🌕',
      '🔮', '🪦', '🦉', '🐺', '🧿', '☠️',
    ],
    reactions: ['🎃', '👻', '😱', '🕷️', '🍬', '🦇', '💀', '🔥'],
    modChip: '🔮',
    modNote: '🔮 You’re conjuring this round',
    watchLabel: '👻 Lurking:',
    awayAvatar: '🪦',
    awayChip: '🕸️',
    stareEmoji: '🎃',
    dissentLabel: 'the coven stares 🕯️',
    celebration: 'monstermash',
    sounds: { pop: 'ghostPop', reveal: 'hauntedReveal', nudge: 'doorKnock', dissent: 'thunder' },
  },
  thanksgiving: {
    icon: '🦃',
    tagline: 'Planning poker with all the trimmings. 🥧',
    toggleLabel: '🦃 Feast mode',
    emojis: [
      '🦃', '🍁', '🥧', '🌽', '🍂', '🥔',
      '🍗', '🥕', '🍞', '🧈', '🍠', '🥜',
      '🍎', '🍊', '🌰', '🎃', '🥣', '🍇',
      '🫖', '🌾', '🍄', '🦌', '🐿️', '🥂',
    ],
    reactions: ['🦃', '🥧', '😋', '🍁', '👏', '❤️', '😴', '🍗'],
    modChip: '🍽️',
    modNote: '🍽️ You’re hosting this round',
    watchLabel: '🥧 Snacking:',
    awayAvatar: '😴',
    awayChip: '🍂',
    stareEmoji: '🦃',
    dissentLabel: 'no pie for you 🥧',
    celebration: 'gobble',
    sounds: { pop: 'pluck', reveal: 'harvestReveal', nudge: 'dinnerBell', dissent: 'gobbleWomp' },
  },
};

const FAVICON = (emoji) =>
  `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>${emoji}</text></svg>`;

export function applyDocumentTheme(season) {
  const t = THEMES[season] || null;
  document.documentElement.dataset.theme = season || '';
  document.title = `Point Party ${t ? t.icon : '🎉'}`;
  const icon = document.querySelector('link[rel="icon"]');
  if (icon) icon.href = FAVICON(t ? t.icon : '🎉');
}
