// Hand-drawn SVG icons for every power (glowing glyphs on a dark orb).
let uid = 0;

const GLYPHS = {
  lightning: (c) =>
    `<path d="M36 6 18 36h12l-4 22 20-32H34z" fill="url(#${c.g})" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`,
  fireball: (c) =>
    `<path d="M32 58c-11 0-18-8-18-18 0-9 6-14 8-22 4 5 5 9 5 13 3-6 7-12 6-25 9 6 17 17 17 32 0 12-7 20-18 20z" fill="url(#${c.g})"/><path d="M32 56c-6 0-10-4-10-10 0-6 5-9 6-14 3 4 4 6 4 9 2-3 4-5 4-9 4 4 6 9 6 14 0 6-4 10-10 10z" fill="#fff6c8"/>`,
  aura: (c) =>
    `<circle cx="32" cy="20" r="7" fill="#fff"/><path d="M18 56c0-12 6-22 14-22s14 10 14 22z" fill="#fff"/><path d="M32 6c-9 0-15 7-15 15 0 4 1 7 3 9-6 5-9 14-9 26M32 6c9 0 15 7 15 15 0 4-1 7-3 9 6 5 9 14 9 26" fill="none" stroke="url(#${c.g})" stroke-width="4" stroke-linecap="round"/>`,
  telekinesis: (c) =>
    `<path d="M22 58V40l-5-8 3-2 6 6V22a2.5 2.5 0 0 1 5 0v12-16a2.5 2.5 0 0 1 5 0v16-13a2.5 2.5 0 0 1 5 0v14-9a2.5 2.5 0 0 1 5 0v16c0 9-5 16-12 16z" fill="#fff" opacity=".95"/><rect x="8" y="8" width="10" height="10" rx="2" fill="url(#${c.g})" transform="rotate(-15 13 13)"/><path d="M48 4l8 6-3 9h-10l-3-9z" fill="url(#${c.g})"/><circle cx="32" cy="8" r="4" fill="url(#${c.g})"/>`,
  teleport: (c) =>
    `<ellipse cx="32" cy="50" rx="22" ry="7" fill="none" stroke="url(#${c.g})" stroke-width="4"/><ellipse cx="32" cy="50" rx="13" ry="4" fill="none" stroke="#fff" stroke-width="2"/><rect x="28" y="6" width="8" height="44" rx="4" fill="url(#${c.g})" opacity=".7"/><g fill="#fff"><rect x="18" y="16" width="4" height="4"/><rect x="43" y="22" width="3" height="3"/><rect x="22" y="30" width="3" height="3"/><rect x="40" y="10" width="4" height="4"/></g>`,
  floating: (c) =>
    `<path d="M32 4l12 14-12 22-12-22z" fill="url(#${c.g})" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/><path d="M20 18h24M32 4v36" stroke="#fff" stroke-width="1" opacity=".6"/><path d="M10 38l6 7-6 8-6-8zM54 34l6 7-6 8-6-8z" fill="url(#${c.g})"/><ellipse cx="32" cy="54" rx="18" ry="4" fill="none" stroke="#fff" stroke-width="2" opacity=".7"/>`,
  circle: (c) =>
    `<circle cx="32" cy="32" r="26" fill="none" stroke="url(#${c.g})" stroke-width="3.5"/><circle cx="32" cy="32" r="21" fill="none" stroke="url(#${c.g})" stroke-width="1.5" stroke-dasharray="3 3"/><path d="M32 13l17.6 28.5H14.4zM32 51 14.4 22.5h35.2z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><circle cx="32" cy="32" r="5" fill="#fff"/>`,
  plasma: (c) =>
    `<circle cx="32" cy="32" r="20" fill="url(#${c.g})" opacity=".45"/><g fill="none" stroke="#fff" stroke-width="2"><ellipse cx="32" cy="32" rx="26" ry="9"/><ellipse cx="32" cy="32" rx="26" ry="9" transform="rotate(60 32 32)"/><ellipse cx="32" cy="32" rx="26" ry="9" transform="rotate(-60 32 32)"/></g><circle cx="32" cy="32" r="7" fill="#fff"/>`,
  galaxy: (c) =>
    `<path d="M32 32c0-8 10-10 15-4 7 8 0 22-13 22C18 50 10 36 16 24 22 12 40 8 50 16" fill="none" stroke="url(#${c.g})" stroke-width="4" stroke-linecap="round"/><path d="M32 32c0 8-10 10-15 4-7-8 0-22 13-22 16 0 24 14 18 26-6 12-24 16-34 8" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/><circle cx="32" cy="32" r="5" fill="#fff"/>`,
  sakura: (c) =>
    `<g transform="translate(32 32)">${[0, 72, 144, 216, 288]
      .map((a) => `<path d="M0 0C-9-6-9-18-3-24L0-20 3-24C9-18 9-6 0 0z" fill="url(#${c.g})" transform="rotate(${a})"/>`)
      .join('')}<circle r="4" fill="#ffe08a"/></g>`,
  firebeam: (c) =>
    `<path d="M10 54V36l6-6V18a3 3 0 0 1 6 0v14" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 20 58 6" stroke="url(#${c.g})" stroke-width="9" stroke-linecap="round"/><path d="M22 20 58 6" stroke="#fff6c8" stroke-width="3" stroke-linecap="round"/><circle cx="21" cy="20" r="5" fill="#fff6c8"/>`,
  kamehameha: (c) =>
    `<circle cx="32" cy="30" r="13" fill="url(#${c.g})"/><circle cx="32" cy="30" r="6" fill="#fff"/><path d="M12 50c0-10 4-16 10-19M52 50c0-10-4-16-10-19" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M32 14V4M46 18l6-6M18 18l-6-6" stroke="url(#${c.g})" stroke-width="3" stroke-linecap="round"/>`,
  saber: (c) =>
    `<path d="M14 50 50 14" stroke="url(#${c.g})" stroke-width="10" stroke-linecap="round" opacity=".6"/><path d="M16 48 50 14" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M8 56l9-9" stroke="#b9bec8" stroke-width="8" stroke-linecap="round"/><path d="M8 56l9-9" stroke="#3a3c44" stroke-width="3" stroke-dasharray="2 2"/>`,
  portal: (c) =>
    `<circle cx="32" cy="32" r="22" fill="#1b1036"/><path d="M14 40c6-6 10-2 18-8s12-4 18 2v10H14z" fill="#c24a3a" opacity=".8"/><circle cx="32" cy="32" r="22" fill="none" stroke="url(#${c.g})" stroke-width="5" stroke-dasharray="2 3"/><circle cx="32" cy="32" r="24" fill="none" stroke="#fff" stroke-width="1.5"/>`,
};

export function powerIcon(id, tint) {
  const c = { g: `pg${++uid}`, b: `pb${uid}` };
  const glyph = (GLYPHS[id] || GLYPHS.lightning)(c);
  return `<svg class="power-svg" viewBox="0 0 64 64" aria-hidden="true">
<defs>
<linearGradient id="${c.g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="${tint}"/><stop offset="1" stop-color="${tint}" stop-opacity=".85"/></linearGradient>
<filter id="${c.b}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<g filter="url(#${c.b})">${glyph}</g>
</svg>`;
}
