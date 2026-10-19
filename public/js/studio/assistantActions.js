import { db, uid } from './db.js';
import { addClip, clipEnd, createClip, createTrack, projectDuration } from './project.js';
import { defaultTransition, TRANSITION_MAP } from './engine/transitions.js';
import { STYLED_TEXTS } from './textStyles.js';
import { importCatalogItem } from './music.js';

/**
 * Bridge between SOLVEX AI and the editors. Projects live in this browser
 * (IndexedDB): the assistant only receives a summary of the project the user
 * attached, and its proposals are applied here, after the user confirms.
 */

/** Summary sent to the assistant (no media data, only structure). */
export function projectSummary(project) {
  const base = { id: project.id, name: project.name, type: project.type, aspect: project.settings?.aspect, width: project.settings?.width, height: project.settings?.height };
  if (project.type === 'photo') return { ...base, layers: (project.layers || []).map((l) => ({ kind: l.kind, name: l.name, text: l.text?.content })) };
  return {
    ...base,
    duration: projectDuration(project),
    clips: (project.clips || [])
      .slice()
      .sort((a, b) => a.start - b.start)
      .map((c) => ({ kind: c.kind, name: c.name, start: c.start, duration: c.duration, text: c.text?.content, transition: c.transitionIn?.type })),
  };
}

const describe = {
  add_title: (o) => `Ajouter le titre « ${o.text} »${o.style_id ? ` (style ${STYLED_TEXTS.find((p) => p.id === o.style_id)?.label || o.style_id})` : ''}${o.start !== undefined ? ` à ${o.start} s` : ''}${o.duration ? ` pendant ${o.duration} s` : ''}`,
  add_music: (o) => `Ajouter la musique ${o.catalog_id.replace(/^\w+:/, '')} de la bibliothèque SOLVEX`,
  set_transitions: (o) => `Mettre la transition « ${TRANSITION_MAP[o.transition]?.label || o.transition} » en entrée de chaque clip`,
  rename_project: (o) => `Renommer le projet en « ${o.name} »`,
};
export const describeOperation = (o) => (describe[o.op] || (() => o.op))(o);

/** Applies confirmed operations to the saved project; returns what was done and what was skipped. */
export async function applyProjectOperations(projectId, operations) {
  let project = await db.getProject(projectId);
  if (!project) throw new Error('Projet introuvable dans ce navigateur.');
  const done = [];
  const skipped = [];
  for (const o of operations) {
    if (o.op === 'rename_project') {
      project = { ...project, name: o.name.slice(0, 80) };
      done.push(describeOperation(o));
    } else if (o.op === 'add_title') {
      const preset = STYLED_TEXTS.find((p) => p.id === o.style_id) || STYLED_TEXTS.find((p) => p.id === 'elegant-classique');
      const text = { ...structuredClone(preset.text), content: o.text };
      if (project.type === 'photo') {
        const layer = { id: uid('l'), kind: 'text', name: preset.label, x: 0.5, y: preset.transform?.y ?? 0.5, scale: 1, rotation: 0, opacity: 1, blend: 'source-over', flipH: false, flipV: false, hidden: false, adjust: {}, crop: { x: 0, y: 0, w: 1, h: 1 }, text: { ...text, animIn: 'none', animOut: 'none', loop: 'none' } };
        project = { ...project, layers: [...(project.layers || []), layer] };
      } else {
        let track = project.tracks.find((t) => t.kind === 'text' && !t.locked);
        if (!track) {
          track = createTrack('text');
          project = { ...project, tracks: [track, ...project.tracks] };
        }
        const clip = createClip('text', { trackId: track.id, start: o.start ?? 0, duration: o.duration ?? 3, text, name: preset.label, transform: { x: 0.5, y: 0.5, scale: 1, rotation: 0, opacity: 1, ...(preset.transform || {}) } });
        project = addClip(project, clip);
      }
      done.push(describeOperation(o));
    } else if (o.op === 'add_music') {
      if (project.type === 'photo') {
        skipped.push(`${describeOperation(o)} : impossible dans un projet photo`);
        continue;
      }
      const media = await importCatalogItem(o.catalog_id);
      let track = project.tracks.find((t) => t.kind === 'audio' && t.role === 'music' && !t.locked) || project.tracks.find((t) => t.kind === 'audio' && !t.locked);
      if (!track) {
        track = createTrack('audio', { role: 'music', name: 'Musique' });
        project = { ...project, tracks: [...project.tracks, track] };
      }
      const videoEnd = Math.max(0, ...project.clips.filter((c) => c.kind !== 'audio').map(clipEnd));
      const duration = Math.min(media.duration || 30, videoEnd || media.duration || 30);
      const clip = createClip('audio', { mediaId: media.id, trackId: track.id, start: 0, duration, name: media.name });
      clip.audio = { ...clip.audio, fadeOut: Math.min(2, duration / 2) };
      project = { ...addClip(project, clip), mediaIds: [...new Set([...(project.mediaIds || []), media.id])] };
      done.push(describeOperation(o));
    } else if (o.op === 'set_transitions') {
      if (project.type === 'photo' || !TRANSITION_MAP[o.transition]) {
        skipped.push(`${describeOperation(o)} : non applicable`);
        continue;
      }
      let count = 0;
      project = {
        ...project,
        clips: project.clips.map((c) => {
          if (!['video', 'image'].includes(c.kind)) return c;
          count += 1;
          return { ...c, transitionIn: { ...defaultTransition(o.transition), duration: Math.min(0.8, c.duration / 2) } };
        }),
      };
      if (count) done.push(`${describeOperation(o)} (${count} clip${count > 1 ? 's' : ''})`);
      else skipped.push(`${describeOperation(o)} : aucun clip vidéo ou image dans le projet`);
    }
  }
  await db.putProject({ ...project, updatedAt: new Date().toISOString(), saved: true });
  return { project, done, skipped };
}
