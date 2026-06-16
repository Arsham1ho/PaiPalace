// Poker / gambling themed agent avatars, rendered as self-contained SVG data URIs
// (no external service, no emoji). Used as agent images + the default fallback.

const BGS = ["#143a2e", "#7a1f2b", "#1b2740", "#284f9e", "#0e7490", "#3a2a5e", "#2a2f3a", "#9a7b1e"];

const SYMBOLS: Record<string, string> = {
  spade: '<path d="M12 2C9 6 5 8 5 12a3.5 3.5 0 0 0 6 2.4C10.7 16 10 17 9 17.5h6C14 17 13.3 16 13 14.4A3.5 3.5 0 0 0 19 12c0-4-4-6-7-10z" fill="#fff"/>',
  heart: '<path d="M12 20.5S4 15 4 9.4A3.3 3.3 0 0 1 12 7a3.3 3.3 0 0 1 8 2.4C20 15 12 20.5 12 20.5z" fill="#fff"/>',
  diamond: '<path d="M12 2.5l6.5 9.5L12 21.5 5.5 12z" fill="#fff"/>',
  club: '<path d="M12 2.5a3 3 0 0 1 2.5 4.7A3 3 0 1 1 13 12.8c.2 1.7 1 3 2 3.7H9c1-.7 1.8-2 2-3.7A3 3 0 1 1 9.5 7.2 3 3 0 0 1 12 2.5z" fill="#fff"/>',
  chip: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="12" r="4" fill="#ffffff40" stroke="#fff" stroke-width="1.2"/><g fill="#fff"><rect x="11.2" y="2.4" width="1.6" height="3"/><rect x="11.2" y="18.6" width="1.6" height="3"/><rect x="2.4" y="11.2" width="3" height="1.6"/><rect x="18.6" y="11.2" width="3" height="1.6"/></g>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3.5" fill="none" stroke="#fff" stroke-width="1.6"/><g fill="#fff"><circle cx="8.4" cy="8.4" r="1.3"/><circle cx="15.6" cy="8.4" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="8.4" cy="15.6" r="1.3"/><circle cx="15.6" cy="15.6" r="1.3"/></g>',
  crown: '<path d="M3 8.5l4 3 5-7 5 7 4-3-2 10.5H5z" fill="#fff"/>',
  dollar: '<text x="12" y="17.5" font-size="16" font-family="Arial,Helvetica,sans-serif" font-weight="700" text-anchor="middle" fill="#fff">$</text>',
  ace: '<rect x="6" y="3" width="12" height="18" rx="2.2" fill="#fff"/><text x="12" y="13.5" font-size="7.5" font-family="Arial,Helvetica,sans-serif" font-weight="700" text-anchor="middle" fill="#111">A</text><path d="M12 14.2c-1 1.3-2.2 1.9-2.2 3a1.3 1.3 0 0 0 2.2.9 1.3 1.3 0 0 0 2.2-.9c0-1.1-1.2-1.7-2.2-3z" fill="#111"/>',
  star: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z" fill="#fff"/>',
};

const keys = Object.keys(SYMBOLS);

function buildAvatar(symbol: string, bg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96"><rect width="24" height="24" rx="6" fill="${bg}"/>${SYMBOLS[symbol]}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// 16 themed avatars (symbols paired across the casino palette)
export const POKER_AVATARS: string[] = Array.from({ length: 16 }, (_, i) =>
  buildAvatar(keys[i % keys.length], BGS[(i * 3) % BGS.length]),
);

// Robot avatars (generated) — offered as an alternative image set.
const ROBOT_SEEDS = ["ace", "bluff", "chip", "dealer", "river", "flop", "turn", "shark", "rocket", "fox", "bull", "ghost", "ninja", "viper", "comet", "atlas", "echo", "nova", "pixel", "rogue"];
export const ROBOT_AVATARS: string[] = ROBOT_SEEDS.map(
  (s) => `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${s}&radius=18&backgroundColor=284f9e,3a6ad0,22d3ee,1b2330`,
);

// deterministic pick from a string (stable per agent name)
export function pokerAvatarFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0x7fffffff;
  return POKER_AVATARS[h % POKER_AVATARS.length];
}

export function randomPokerAvatar(): string {
  return POKER_AVATARS[Math.floor(Math.random() * POKER_AVATARS.length)];
}
