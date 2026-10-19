import { svg } from '../lib/dom.js';

let uid = 0;

/**
 * The SOLVEX mark: a glossy diamond frame (violet on the left, electric blue
 * to cyan on the right) around a dark gap and a two-facet prism core.
 * `animated` adds the classes the intro sequence uses to draw it.
 */
export function logoMark({ animated = false, title = 'SOLVEX AI' } = {}) {
  const id = `sx${++uid}`;
  const a = (cls) => (animated ? ` class="${cls}"` : '');
  return svg(`
<svg viewBox="0 0 64 64" role="img" aria-label="${title}">
  <defs>
    <linearGradient id="${id}-band" x1="4" y1="20" x2="60" y2="44" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#B47BFF"/><stop offset=".45" stop-color="#7A5CFF"/><stop offset=".75" stop-color="#4263FF"/><stop offset="1" stop-color="#45E5F5"/>
    </linearGradient>
    <linearGradient id="${id}-edge" x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#E9D9FF"/><stop offset=".5" stop-color="#8FB0FF"/><stop offset="1" stop-color="#7FF3FF"/>
    </linearGradient>
    <linearGradient id="${id}-top" x1="19" y1="19" x2="45" y2="32" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#E2C6FF"/><stop offset="1" stop-color="#7FA2FF"/>
    </linearGradient>
    <linearGradient id="${id}-bottom" x1="19" y1="32" x2="45" y2="45" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#6A4DF5"/><stop offset="1" stop-color="#3E8BFF"/>
    </linearGradient>
    <clipPath id="${id}-clip"><path fill-rule="evenodd" clip-rule="evenodd" d="M32 3 61 32 32 61 3 32Z M32 15 49 32 32 49 15 32Z"/></clipPath>
  </defs>
  <path${a('facet facet--a')} fill="url(#${id}-band)" fill-rule="evenodd" d="M32 3 61 32 32 61 3 32Z M32 15 49 32 32 49 15 32Z"/>
  <g clip-path="url(#${id}-clip)"${a('beam')}><path d="M6 30C14 24 18 34 26 26S34 12 40 9 M9 36C18 31 22 40 31 33 M58 34C50 40 46 30 38 38S30 52 24 55 M55 28C46 33 42 24 33 31" fill="none" stroke="#FFFFFF" stroke-opacity=".28" stroke-width=".7"/></g>
  <path${animated ? ' class="draw" pathLength="1"' : ''} d="M32 3 61 32 32 61 3 32Z" fill="none" stroke="url(#${id}-edge)" stroke-width="1.6" stroke-linejoin="round"/>
  <path${a('beam')} d="M32 15 49 32 32 49 15 32Z" fill="none" stroke="#C9B6FF" stroke-opacity=".6" stroke-width="1"/>
  <path${a('facet facet--b')} d="M32 19 45 32H19Z" fill="url(#${id}-top)"/>
  <path${a('facet facet--b')} d="M19 32H45L32 45Z" fill="url(#${id}-bottom)"/>
  <path${a('spark')} d="M19 32H45" stroke="#F5F7FF" stroke-opacity=".75" stroke-width=".6"/>
</svg>`);
}

/** Same artwork as a standalone SVG string (used for generated files). */
export function logoSvgString(size = 64) {
  const el = logoMark({ title: 'SOLVEX AI' });
  el.setAttribute('width', size);
  el.setAttribute('height', size);
  el.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return el.outerHTML;
}
