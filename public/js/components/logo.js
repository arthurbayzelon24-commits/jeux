import { svg } from '../lib/dom.js';

let uid = 0;

/**
 * The SOLVEX mark: a hexagonal portal crossed by two prism facets (light being
 * refracted into form) with a spark at the corner. `animated` adds the classes
 * the intro sequence uses to draw it stroke by stroke.
 */
export function logoMark({ animated = false, title = 'SOLVEX AI' } = {}) {
  const id = `sx${++uid}`;
  const draw = animated ? ' class="draw" pathLength="1"' : '';
  return svg(`
<svg viewBox="0 0 64 64" role="img" aria-label="${title}">
  <defs>
    <linearGradient id="${id}-ring" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#45E5F5"/><stop offset=".5" stop-color="#4263FF"/><stop offset="1" stop-color="#8B5CF6"/>
    </linearGradient>
    <linearGradient id="${id}-a" x1="14" y1="18" x2="46" y2="30" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#4263FF"/><stop offset="1" stop-color="#45E5F5"/>
    </linearGradient>
    <linearGradient id="${id}-b" x1="18" y1="34" x2="50" y2="46" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8B5CF6"/><stop offset="1" stop-color="#4263FF"/>
    </linearGradient>
  </defs>
  <path${draw} d="M32 4.5 55.8 18.25v27.5L32 59.5 8.2 45.75v-27.5Z" fill="none" stroke="url(#${id}-ring)" stroke-width="3.2" stroke-linejoin="round"/>
  <path${animated ? ' class="facet facet--a"' : ''} d="M24.5 18.5h21l-7 10h-21Z" fill="url(#${id}-a)"/>
  <path${animated ? ' class="facet facet--b"' : ''} d="M25.5 35.5h21l-7 10h-21Z" fill="url(#${id}-b)"/>
  <g${animated ? ' class="beam"' : ''}>
    <path d="M17.5 28.5 25.5 35.5" stroke="#45E5F5" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M45.5 18.5 46.5 35.5" stroke="#8B5CF6" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>
  </g>
  <path${animated ? ' class="spark"' : ''} d="M50 9.5l1.3 3.2 3.2 1.3-3.2 1.3-1.3 3.2-1.3-3.2-3.2-1.3 3.2-1.3Z" fill="#45E5F5"/>
</svg>`);
}
