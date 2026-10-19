import { uid } from './db.js';

export const PROJECT_VERSION = 1;
export const MIN_CLIP = 0.1; // seconds

export const ASPECTS = {
  '16:9': { width: 1920, height: 1080, label: 'Paysage 16:9' },
  '9:16': { width: 1080, height: 1920, label: 'Vertical 9:16' },
  '1:1': { width: 1080, height: 1080, label: 'Carré 1:1' },
  '4:5': { width: 1080, height: 1350, label: 'Portrait 4:5' },
  '4:3': { width: 1440, height: 1080, label: '4:3' },
  '21:9': { width: 2520, height: 1080, label: 'Cinéma 21:9' },
};

export const defaultTransform = () => ({ x: 0.5, y: 0.5, scale: 1, rotation: 0, opacity: 1 });
export const defaultColor = () => ({ exposure: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, hue: 0, vignette: 0 });
export const defaultAudio = () => ({ volume: 1, fadeIn: 0, fadeOut: 0, pan: 0 });
export const defaultMask = () => ({ type: 'none', x: 0.5, y: 0.5, w: 0.6, h: 0.6, feather: 0.05, invert: false });
export const defaultChroma = () => ({ enabled: false, color: '#00ff00', tolerance: 0.35, softness: 0.1, spill: 0.5 });
export const defaultText = () => ({
  content: 'Votre titre',
  font: 'Inter, "Segoe UI", system-ui, sans-serif',
  size: 96,
  weight: 700,
  italic: false,
  color: '#F5F7FF',
  gradient: null, // e.g. ['#45E5F5', '#8B5CF6']
  stroke: '#000000',
  strokeWidth: 0,
  shadow: 0.4,
  background: null,
  align: 'center',
  letterSpacing: 0,
  lineHeight: 1.15,
  animIn: 'fade',
  animOut: 'fade',
  animDuration: 0.5,
});

export function createTrack(kind, extra = {}) {
  const names = { video: 'Vidéo', audio: 'Audio', text: 'Texte' };
  return { id: uid('t'), kind, name: names[kind], locked: false, hidden: false, muted: false, volume: 1, role: null, ...extra };
}

export function createProject({ name = 'Projet sans titre', type = 'video', aspect = '16:9', fps = 30 } = {}) {
  const now = new Date().toISOString();
  const size = ASPECTS[aspect] || ASPECTS['16:9'];
  const base = {
    id: uid('p'),
    version: PROJECT_VERSION,
    name,
    type,
    favorite: false,
    thumbnail: null,
    createdAt: now,
    updatedAt: now,
    saved: true,
    settings: { aspect, width: size.width, height: size.height, fps, background: '#000000' },
  };
  if (type === 'photo') {
    return { ...base, layers: [], background: { type: 'color', color: '#0b1030', colors: ['#16205A', '#080B16'] } };
  }
  return {
    ...base,
    tracks: [
      createTrack('text'),
      createTrack('video', { name: 'Superposition' }),
      createTrack('video'),
      createTrack('audio', { name: 'Voix', role: 'voice' }),
      createTrack('audio', { name: 'Musique', role: 'music' }),
    ],
    clips: [],
    markers: [],
    inPoint: null,
    outPoint: null,
    subtitles: [],
    subtitleStyle: { size: 48, color: '#FFFFFF', background: 'rgba(0,0,0,0.55)', position: 0.88, highlight: '#45E5F5' },
    ducking: { enabled: false, amount: 0.3 },
  };
}

export function createClip(kind, fields = {}) {
  const clip = {
    id: uid('c'),
    kind,
    trackId: null,
    mediaId: null,
    start: 0,
    duration: 5,
    in: 0,
    speed: 1,
    transform: defaultTransform(),
    keyframes: {},
    color: defaultColor(),
    effects: [],
    transitionIn: null,
    transitionOut: null,
    blend: 'source-over',
    mask: defaultMask(),
    chroma: defaultChroma(),
    audio: defaultAudio(),
    group: null,
    name: '',
    ...fields,
  };
  if (kind === 'text') clip.text = { ...defaultText(), ...(fields.text || {}) };
  return clip;
}

// ---------------------------------------------------------------- queries

export const clipEnd = (clip) => clip.start + clip.duration;
export const trackOf = (project, clip) => project.tracks.find((t) => t.id === clip.trackId);
export const clipsOnTrack = (project, trackId) => project.clips.filter((c) => c.trackId === trackId).sort((a, b) => a.start - b.start);

export function projectDuration(project) {
  return project.clips.reduce((max, clip) => Math.max(max, clipEnd(clip)), 0);
}

/** Which track kind accepts a clip kind. */
export function trackKindFor(clipKind) {
  if (clipKind === 'audio') return 'audio';
  if (clipKind === 'text') return 'text';
  return 'video';
}

/** Source duration available for a media clip (Infinity for images/text). */
export function sourceLimit(clip, media) {
  if (!media || (clip.kind !== 'video' && clip.kind !== 'audio')) return Infinity;
  return media.duration || Infinity;
}

// ---------------------------------------------------------------- edits (pure: return a new project)

const clone = (value) => structuredClone(value);
const touch = (project) => ({ ...project, updatedAt: new Date().toISOString(), saved: false });

export function addClip(project, clip) {
  return touch({ ...project, clips: [...project.clips, clip] });
}

export function updateClips(project, ids, updater) {
  const set = new Set(ids);
  return touch({ ...project, clips: project.clips.map((c) => (set.has(c.id) ? updater(clone(c)) : c)) });
}

export function removeClips(project, ids) {
  const set = new Set(ids);
  return touch({ ...project, clips: project.clips.filter((c) => !set.has(c.id)) });
}

/** Splits every given clip that spans `time`; returns { project, created }. */
export function splitAt(project, ids, time) {
  const set = new Set(ids);
  const created = [];
  const clips = [];
  for (const clip of project.clips) {
    if (!set.has(clip.id) || time <= clip.start + MIN_CLIP || time >= clipEnd(clip) - MIN_CLIP) {
      clips.push(clip);
      continue;
    }
    const offset = time - clip.start;
    const left = clone(clip);
    left.duration = offset;
    left.transitionOut = null;
    const right = clone(clip);
    right.id = uid('c');
    right.start = time;
    right.duration = clip.duration - offset;
    right.in = clip.in + offset * clip.speed;
    right.transitionIn = null;
    // keyframes are relative to the clip start: shift them for the right part
    left.keyframes = sliceKeyframes(clip.keyframes, 0, offset);
    right.keyframes = sliceKeyframes(clip.keyframes, offset, clip.duration, -offset);
    clips.push(left, right);
    created.push(right.id);
  }
  return { project: touch({ ...project, clips }), created };
}

function sliceKeyframes(keyframes, from, to, shift = 0) {
  const out = {};
  for (const [prop, list] of Object.entries(keyframes || {})) {
    const kept = list.filter((k) => k.t >= from && k.t <= to).map((k) => ({ ...k, t: k.t + shift }));
    if (kept.length) out[prop] = kept;
  }
  return out;
}

/** Removes [from, to] from the given tracks and closes the gap (ripple delete). */
export function rippleDelete(project, from, to, trackIds) {
  let next = project;
  const ids = next.clips.filter((c) => trackIds.includes(c.trackId)).map((c) => c.id);
  next = splitAt(next, ids, to).project;
  next = splitAt(
    next,
    next.clips.filter((c) => trackIds.includes(c.trackId)).map((c) => c.id),
    from,
  ).project;
  const gap = to - from;
  const clips = [];
  for (const clip of next.clips) {
    if (!trackIds.includes(clip.trackId)) {
      clips.push(clip);
      continue;
    }
    if (clip.start >= from - 1e-6 && clipEnd(clip) <= to + 1e-6) continue;
    if (clip.start >= to - 1e-6) clips.push({ ...clip, start: clip.start - gap });
    else clips.push(clip);
  }
  return touch({ ...next, clips });
}

export function duplicateClips(project, ids) {
  const created = [];
  const extra = project.clips
    .filter((c) => ids.includes(c.id))
    .map((c) => {
      const copy = clone(c);
      copy.id = uid('c');
      copy.start = clipEnd(c);
      created.push(copy.id);
      return copy;
    });
  return { project: touch({ ...project, clips: [...project.clips, ...extra] }), created };
}

/** Pastes clips (from the clipboard) so that the earliest starts at `time`. */
export function pasteClips(project, copied, time) {
  if (!copied.length) return { project, created: [] };
  const first = Math.min(...copied.map((c) => c.start));
  const created = [];
  const trackIds = new Set(project.tracks.map((t) => t.id));
  const extra = copied
    .filter((c) => trackIds.has(c.trackId))
    .map((c) => {
      const copy = clone(c);
      copy.id = uid('c');
      copy.start = Math.max(0, time + (c.start - first));
      created.push(copy.id);
      return copy;
    });
  return { project: touch({ ...project, clips: [...project.clips, ...extra] }), created };
}

/** Snap a time to clip edges, markers and the playhead within `threshold` seconds. */
export function snapTime(project, time, { exclude = [], threshold = 0.1, extra = [] } = {}) {
  let best = time;
  let bestDistance = threshold;
  const candidates = [0, ...extra, ...project.markers.map((m) => m.t)];
  for (const clip of project.clips) {
    if (exclude.includes(clip.id)) continue;
    candidates.push(clip.start, clipEnd(clip));
  }
  for (const candidate of candidates) {
    const distance = Math.abs(candidate - time);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

export function groupClips(project, ids) {
  const group = uid('g');
  return updateClips(project, ids, (c) => ({ ...c, group }));
}

export function ungroupClips(project, ids) {
  return updateClips(project, ids, (c) => ({ ...c, group: null }));
}

/** Expands a selection to whole groups. */
export function expandGroups(project, ids) {
  const groups = new Set(project.clips.filter((c) => ids.includes(c.id) && c.group).map((c) => c.group));
  return [...new Set([...ids, ...project.clips.filter((c) => groups.has(c.group)).map((c) => c.id)])];
}

export function changeAspect(project, aspect) {
  const size = ASPECTS[aspect];
  if (!size) return project;
  return touch({ ...project, settings: { ...project.settings, aspect, width: size.width, height: size.height } });
}

/** Minimal structural validation of an imported/loaded project. */
export function validateProject(data) {
  if (!data || typeof data !== 'object') throw new Error('Fichier de projet illisible.');
  if (!['video', 'photo'].includes(data.type)) throw new Error('Type de projet inconnu.');
  if (data.type === 'video' && (!Array.isArray(data.tracks) || !Array.isArray(data.clips))) throw new Error('Projet vidéo incomplet.');
  if (data.type === 'photo' && !Array.isArray(data.layers)) throw new Error('Projet photo incomplet.');
  return data;
}

// ---------------------------------------------------------------- templates

export const TEMPLATES = [
  { id: 'short', name: 'Short vertical', aspect: '9:16', slots: 4, slot: 3, title: 'Votre accroche', category: 'Réseaux sociaux' },
  { id: 'tutorial', name: 'Tutoriel', aspect: '16:9', slots: 3, slot: 8, title: 'Comment faire…', category: 'Éducation' },
  { id: 'slideshow', name: 'Diaporama', aspect: '16:9', slots: 6, slot: 4, title: 'Nos souvenirs', category: 'Photo' },
  { id: 'ad', name: 'Publicité', aspect: '1:1', slots: 3, slot: 3, title: 'Nouveau', category: 'Marketing' },
  { id: 'vlog', name: 'Vlog', aspect: '16:9', slots: 5, slot: 6, title: 'Ma journée', category: 'Lifestyle' },
  { id: 'gaming', name: 'Vidéo de jeu', aspect: '16:9', slots: 3, slot: 10, title: 'Meilleurs moments', category: 'Gaming' },
  { id: 'music', name: 'Clip musical', aspect: '16:9', slots: 8, slot: 2.5, title: '', category: 'Musique' },
  { id: 'travel', name: 'Voyage', aspect: '16:9', slots: 6, slot: 4, title: 'Carnet de voyage', category: 'Lifestyle' },
  { id: 'explainer', name: 'Vidéo explicative', aspect: '16:9', slots: 4, slot: 6, title: 'En 60 secondes', category: 'Éducation' },
  { id: 'story', name: 'Story 4:5', aspect: '4:5', slots: 3, slot: 4, title: 'À la une', category: 'Réseaux sociaux' },
  { id: 'quick', name: 'Montage rapide', aspect: '16:9', slots: 10, slot: 1.5, title: '', category: 'Dynamique' },
  { id: 'presentation', name: 'Présentation', aspect: '16:9', slots: 5, slot: 6, title: 'Présentation', category: 'Professionnel' },
];

/** Builds a project from a template: placeholder slots that accept media, a title and soft transitions. */
export function projectFromTemplate(template) {
  let project = createProject({ name: template.name, type: 'video', aspect: template.aspect });
  const main = project.tracks.find((t) => t.kind === 'video' && t.name === 'Vidéo');
  const textTrack = project.tracks.find((t) => t.kind === 'text');
  for (let i = 0; i < template.slots; i += 1) {
    const placeholder = createClip('placeholder', {
      trackId: main.id,
      start: i * template.slot,
      duration: template.slot,
      name: `Emplacement ${i + 1}`,
      transitionIn: i === 0 ? null : { type: 'fade', duration: Math.min(0.6, template.slot / 4) },
    });
    project = addClip(project, placeholder);
  }
  if (template.title) {
    project = addClip(
      project,
      createClip('text', {
        trackId: textTrack.id,
        start: 0,
        duration: Math.min(3, template.slot * template.slots),
        text: { content: template.title },
      }),
    );
  }
  return { ...project, saved: false };
}
