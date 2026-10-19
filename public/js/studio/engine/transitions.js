/**
 * Clip transitions. A transition is attached to a clip edge
 * (transitionIn / transitionOut = { type, duration, direction, intensity }).
 * `apply` receives the progress p (0 → hidden, 1 → fully shown) and returns
 * how the clip layer is composited: alpha, offset, scale, rotation, blur and
 * an optional clip path. "crossfade" additionally keeps the previous clip of
 * the same track on screen (frozen on its last frame) and fades between both.
 */
const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

export const TRANSITIONS = [
  { id: 'fade', label: 'Fondu', category: 'Classiques', apply: (p) => ({ alpha: p }) },
  { id: 'crossfade', label: 'Fondu enchaîné', category: 'Classiques', inOnly: true, apply: (p) => ({ alpha: p }) },
  {
    id: 'fade-black',
    label: 'Fondu au noir',
    category: 'Classiques',
    apply: (p) => ({ alpha: p, overlay: { color: '#000', alpha: 1 - p } }),
  },
  { id: 'dissolve', label: 'Dissolution', category: 'Classiques', apply: (p) => ({ dissolve: p }) },
  {
    id: 'slide',
    label: 'Glissement',
    category: 'Mouvement',
    directional: true,
    apply: (p, d, k) => ({ dx: DIRS[d][0] * (1 - p) * k, dy: DIRS[d][1] * (1 - p) * k }),
  },
  { id: 'wipe', label: 'Balayage', category: 'Mouvement', directional: true, apply: (p, d) => ({ wipe: { p, d } }) },
  { id: 'zoom-in', label: 'Zoom avant', category: 'Mouvement', apply: (p, d, k) => ({ alpha: p, scale: 1 - 0.5 * k * (1 - p) }) },
  { id: 'zoom-out', label: 'Zoom arrière', category: 'Mouvement', apply: (p, d, k) => ({ alpha: p, scale: 1 + 0.6 * k * (1 - p) }) },
  {
    id: 'spin',
    label: 'Rotation',
    category: 'Mouvement',
    apply: (p, d, k) => ({ alpha: p, rotation: (1 - p) * 180 * k, scale: 0.4 + 0.6 * p }),
  },
  {
    id: 'blur',
    label: 'Flou de mouvement',
    category: 'Mouvement',
    apply: (p, d, k) => ({ alpha: Math.min(1, p * 1.5), blur: (1 - p) * 30 * k }),
  },
  {
    id: 'flash',
    label: 'Flash lumineux',
    category: 'Lumière',
    apply: (p, d, k) => ({ alpha: p, overlay: { color: '#ffffff', alpha: Math.max(0, 1 - p) * k } }),
  },
  {
    id: 'glow',
    label: 'Transition lumineuse',
    category: 'Lumière',
    apply: (p, d, k) => ({ alpha: p, brightness: 1 + (1 - p) * 2 * k, blur: (1 - p) * 12 * k }),
  },
  {
    id: 'glitch',
    label: 'Transition numérique',
    category: 'Numérique',
    apply: (p, d, k) => ({ alpha: p > 0.15 ? 1 : p * 6, glitch: (1 - p) * k }),
  },
  { id: 'iris', label: 'Cercle', category: 'Géométriques', apply: (p) => ({ shape: { type: 'circle', p } }) },
  { id: 'diamond', label: 'Losange', category: 'Géométriques', apply: (p) => ({ shape: { type: 'diamond', p } }) },
  { id: 'bars', label: 'Barres cinéma', category: 'Cinématographiques', apply: (p) => ({ shape: { type: 'bars', p } }) },
  {
    id: 'stretch',
    label: 'Déformation',
    category: 'Déformation',
    apply: (p, d, k) => ({ alpha: p, scaleX: 1 + (1 - p) * 1.5 * k, blur: (1 - p) * 8 * k }),
  },
];

export const TRANSITION_MAP = Object.fromEntries(TRANSITIONS.map((t) => [t.id, t]));
export const DIRECTIONS = { left: 'Gauche', right: 'Droite', up: 'Haut', down: 'Bas' };

export function defaultTransition(type = 'fade') {
  return { type, duration: 0.6, direction: 'left', intensity: 1 };
}

/**
 * Combined compositing state for a clip at local time t.
 * Returns null when no transition is active.
 */
export function transitionState(clip, t) {
  const states = [];
  const tin = clip.transitionIn;
  if (tin && TRANSITION_MAP[tin.type] && t < tin.duration) {
    const p = Math.max(0, Math.min(1, t / tin.duration));
    states.push(TRANSITION_MAP[tin.type].apply(p, tin.direction || 'left', tin.intensity ?? 1));
  }
  const tout = clip.transitionOut;
  if (tout && TRANSITION_MAP[tout.type] && t > clip.duration - tout.duration) {
    const p = Math.max(0, Math.min(1, (clip.duration - t) / tout.duration));
    // Outgoing motion goes the opposite way.
    const opposite = { left: 'right', right: 'left', up: 'down', down: 'up' }[tout.direction || 'left'];
    states.push(TRANSITION_MAP[tout.type].apply(p, opposite, tout.intensity ?? 1));
  }
  if (!states.length) return null;
  return states.reduce((acc, s) => ({
    ...acc,
    ...s,
    alpha: (acc.alpha ?? 1) * (s.alpha ?? 1),
    scale: (acc.scale ?? 1) * (s.scale ?? 1),
  }));
}
