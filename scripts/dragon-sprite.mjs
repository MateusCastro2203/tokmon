// 16x16 pixel-art "Coral Drake" mascot, same design approved in the landing
// page brainstorm (docs/superpowers/specs/2026-07-23-landing-page-design.md).
// One character per pixel; rendered in the terminal as two space-wide
// background-colored cells so it reads roughly square in a monospace font.
export const DRAGON_SPRITE_ROWS = [
  '................',
  '.....h....h.....',
  '.....bbbbbb.....',
  '.....bebbeb.....',
  '.....bbbbbb.....',
  '.www.bbhhbb.www.',
  'wwwwbbbbbbbbwwww',
  'wwwwbbllllbbwwww',
  'wwwwbbllllbbwwww',
  '.wwwbbllllbbwww.',
  '....bbbbbbbb....',
  '.....bb..bbb....',
  '.....bbggbb.b...',
  '......ffff...ff.',
  '.......gg....ff.',
  '................',
];

export const DRAGON_PALETTE = {
  h: '#641220', // horn / outline / mouth
  b: '#e63946', // body
  e: '#1a1a1a', // eye
  w: '#1d3557', // wings
  l: '#f1faee', // belly
  g: '#ffb703', // fire (breath / tail glow)
  f: '#fb8500', // fire (breath / tail tip, brighter)
};

export function hpBarSegments(percentage, totalSegments = 10) {
  const pct = Math.max(0, Math.min(100, percentage ?? 0));
  const filled = Math.round((pct / 100) * totalSegments);
  return { filled, empty: totalSegments - filled, totalSegments };
}
