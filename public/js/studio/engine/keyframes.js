/**
 * Keyframes are stored per property path (e.g. "transform.x", "audio.volume")
 * as [{ t, v, ease }] with t relative to the clip start, sorted by t.
 */
export const EASINGS = {
  linear: (x) => x,
  easeIn: (x) => x * x * x,
  easeOut: (x) => 1 - (1 - x) ** 3,
  easeInOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  hold: () => 0,
};

export const EASING_LABELS = { linear: 'Linéaire', easeIn: 'Accélération', easeOut: 'Décélération', easeInOut: 'Douce', hold: 'Maintien' };

export const ANIMATABLE = [
  { path: 'transform.x', label: 'Position X', min: -0.5, max: 1.5, step: 0.001 },
  { path: 'transform.y', label: 'Position Y', min: -0.5, max: 1.5, step: 0.001 },
  { path: 'transform.scale', label: 'Échelle', min: 0.05, max: 5, step: 0.01 },
  { path: 'transform.rotation', label: 'Rotation', min: -360, max: 360, step: 0.5 },
  { path: 'transform.opacity', label: 'Opacité', min: 0, max: 1, step: 0.01 },
  { path: 'audio.volume', label: 'Volume', min: 0, max: 2, step: 0.01 },
  { path: 'color.exposure', label: 'Exposition', min: -100, max: 100, step: 1 },
  { path: 'color.saturation', label: 'Saturation', min: -100, max: 100, step: 1 },
  { path: 'mask.x', label: 'Masque X', min: 0, max: 1, step: 0.001 },
  { path: 'mask.y', label: 'Masque Y', min: 0, max: 1, step: 0.001 },
  { path: 'mask.w', label: 'Masque largeur', min: 0.02, max: 2, step: 0.001 },
  { path: 'mask.h', label: 'Masque hauteur', min: 0.02, max: 2, step: 0.001 },
];

export function getPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

export function setPath(obj, path, value) {
  const keys = path.split('.');
  let target = obj;
  for (const key of keys.slice(0, -1)) target = target[key] ??= {};
  target[keys.at(-1)] = value;
}

/** Value of a property at local time t (seconds from clip start). */
export function valueAt(clip, path, t) {
  const list = clip.keyframes?.[path];
  if (!list || list.length === 0) return getPath(clip, path);
  if (t <= list[0].t) return list[0].v;
  const last = list[list.length - 1];
  if (t >= last.t) return last.v;
  for (let i = 0; i < list.length - 1; i += 1) {
    const a = list[i];
    const b = list[i + 1];
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t || 1;
      const ease = EASINGS[a.ease] || EASINGS.linear;
      return a.v + (b.v - a.v) * ease((t - a.t) / span);
    }
  }
  return last.v;
}

/** Returns a copy of the clip with every animated property resolved at time t. */
export function resolveClip(clip, t) {
  if (!clip.keyframes || Object.keys(clip.keyframes).length === 0) return clip;
  const resolved = structuredClone(clip);
  for (const path of Object.keys(clip.keyframes)) setPath(resolved, path, valueAt(clip, path, t));
  return resolved;
}

export function setKeyframe(clip, path, t, v, ease = 'easeInOut') {
  const list = [...(clip.keyframes?.[path] || [])].filter((k) => Math.abs(k.t - t) > 1e-3);
  list.push({ t, v, ease });
  list.sort((a, b) => a.t - b.t);
  clip.keyframes = { ...(clip.keyframes || {}), [path]: list };
  return clip;
}

export function removeKeyframe(clip, path, t) {
  const list = (clip.keyframes?.[path] || []).filter((k) => Math.abs(k.t - t) > 1e-3);
  const next = { ...(clip.keyframes || {}) };
  if (list.length) next[path] = list;
  else delete next[path];
  clip.keyframes = next;
  return clip;
}

/** Ready-made motion presets expressed as keyframes over the clip duration. */
export const MOTION_PRESETS = {
  'ken-burns': {
    label: 'Zoom lent (Ken Burns)',
    build: (d) => ({
      'transform.scale': [
        { t: 0, v: 1, ease: 'linear' },
        { t: d, v: 1.15, ease: 'linear' },
      ],
    }),
  },
  'zoom-out': {
    label: 'Dézoom',
    build: (d) => ({
      'transform.scale': [
        { t: 0, v: 1.25, ease: 'easeOut' },
        { t: d, v: 1, ease: 'linear' },
      ],
    }),
  },
  'pan-left': {
    label: 'Panoramique gauche',
    build: (d) => ({
      'transform.scale': [{ t: 0, v: 1.2, ease: 'linear' }],
      'transform.x': [
        { t: 0, v: 0.58, ease: 'linear' },
        { t: d, v: 0.42, ease: 'linear' },
      ],
    }),
  },
  'pan-right': {
    label: 'Panoramique droite',
    build: (d) => ({
      'transform.scale': [{ t: 0, v: 1.2, ease: 'linear' }],
      'transform.x': [
        { t: 0, v: 0.42, ease: 'linear' },
        { t: d, v: 0.58, ease: 'linear' },
      ],
    }),
  },
  'drop-in': {
    label: 'Arrivée par le haut',
    build: (d) => ({
      'transform.y': [
        { t: 0, v: -0.3, ease: 'easeOut' },
        { t: Math.min(0.8, d), v: 0.5, ease: 'linear' },
      ],
    }),
  },
  spin: {
    label: 'Rotation complète',
    build: (d) => ({
      'transform.rotation': [
        { t: 0, v: 0, ease: 'easeInOut' },
        { t: d, v: 360, ease: 'linear' },
      ],
    }),
  },
  'fade-in-out': {
    label: 'Apparition et disparition',
    build: (d) => ({
      'transform.opacity': [
        { t: 0, v: 0, ease: 'easeOut' },
        { t: Math.min(0.6, d / 3), v: 1, ease: 'linear' },
        { t: Math.max(d - 0.6, (d * 2) / 3), v: 1, ease: 'easeIn' },
        { t: d, v: 0, ease: 'linear' },
      ],
    }),
  },
};
