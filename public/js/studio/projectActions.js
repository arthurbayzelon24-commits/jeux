import { h, clear, formatDate, svg } from '../lib/dom.js';
import { icon } from '../components/icons.js';
import { confirmDialog, openModal, toast } from '../components/feedback.js';
import { logoMark } from '../components/logo.js';
import { navigate } from '../router.js';
import { db, uid } from './db.js';
import { createProject, createClip, addClip, ASPECTS, validateProject } from './project.js';
import { ACCEPT, ACCEPT_ATTR, importFiles, importFile } from './media.js';
import { openRecorder } from './ui/recorder.js';
import { saveFile } from '../lib/download.js';
import { isStatic } from '../lib/env.js';

/**
 * Everything that creates, opens or manages a project, shared by the home
 * page, the projects page and the editors.
 */

export const editorPath = (project) => `/studio/${project.type === 'photo' ? 'photo' : 'video'}?id=${project.id}`;

export async function saveAndOpen(project) {
  await db.putProject({ ...project, saved: true });
  navigate(editorPath(project));
}

function photoLayer(media) {
  return { id: uid('l'), kind: 'image', mediaId: media.id, name: media.name, x: 0.5, y: 0.5, scale: 1, rotation: 0, opacity: 1, blend: 'source-over', flipH: false, flipV: false, crop: { x: 0, y: 0, w: 1, h: 1 }, adjust: {}, hidden: false };
}

/** Video project whose library holds the imported files, laid end to end on the timeline. */
export function videoProjectFromMedia(results, { name, aspect = '16:9' } = {}) {
  let project = createProject({ name: name || 'Nouveau montage', type: 'video', aspect });
  const main = project.tracks.find((t) => t.kind === 'video' && t.name === 'Vidéo');
  const music = project.tracks.find((t) => t.kind === 'audio' && t.role === 'music');
  let cursor = 0;
  let audioCursor = 0;
  for (const m of results) {
    if (m.kind === 'audio') {
      project = addClip(project, createClip('audio', { mediaId: m.id, trackId: music.id, start: audioCursor, duration: m.duration || 5, name: m.name }));
      audioCursor += m.duration || 5;
    } else {
      const duration = m.kind === 'image' ? 5 : m.duration || 5;
      project = addClip(project, createClip(m.kind, { mediaId: m.id, trackId: main.id, start: cursor, duration, name: m.name }));
      cursor += duration;
    }
  }
  // Adopt the format of the first video/image so it is not letterboxed.
  const first = results.find((m) => m.width && m.height);
  if (first && !aspect) {
    const ratio = first.width / first.height;
    const best = Object.entries(ASPECTS).sort((a, b) => Math.abs(a[1].width / a[1].height - ratio) - Math.abs(b[1].width / b[1].height - ratio))[0][0];
    project = { ...project, settings: { ...project.settings, aspect: best, width: ASPECTS[best].width, height: ASPECTS[best].height } };
  }
  return { ...project, mediaIds: results.map((m) => m.id) };
}

export function photoProjectFromMedia(media, { name } = {}) {
  const project = createProject({ name: name || media?.name?.replace(/\.[^.]+$/, '') || 'Nouvelle image', type: 'photo' });
  if (!media) return project;
  return { ...project, mediaIds: [media.id], settings: { ...project.settings, aspect: 'custom', width: media.width, height: media.height }, layers: [photoLayer(media)] };
}

async function importWithFeedback(files, status) {
  const { results, errors } = await importFiles(files, (i, n, name) => status && (status.textContent = `Import ${i}/${n} : ${name}…`));
  errors.forEach((e) => toast(e, { type: 'error', duration: 8000 }));
  return results;
}

/** Opens the native picker for a new video project; the editor opens as soon as files are imported. */
export function videoPickerInput({ onStart, onOpen } = {}) {
  const input = h('input', { type: 'file', multiple: true, accept: ACCEPT_ATTR, hidden: true });
  input.addEventListener('change', async () => {
    const files = [...input.files];
    input.value = '';
    if (!files.length) return;
    onStart?.();
    const results = await importWithFeedback(files);
    if (!results.length) return;
    onOpen?.();
    await saveAndOpen(videoProjectFromMedia(results, { aspect: null }));
  });
  return input;
}

export function photoPickerInput({ onStart, onOpen } = {}) {
  const input = h('input', { type: 'file', accept: ACCEPT.image.join(','), hidden: true });
  input.addEventListener('change', async () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    onStart?.();
    const [media] = await importWithFeedback([file]);
    if (!media) return;
    onOpen?.();
    await saveAndOpen(photoProjectFromMedia(media));
  });
  return input;
}

// Small original illustrations for the creation cards.
const ART = {
  video: `<svg viewBox="0 0 160 96" aria-hidden="true"><defs><linearGradient id="av" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4263FF"/><stop offset="1" stop-color="#8B5CF6"/></linearGradient></defs><rect x="14" y="10" width="132" height="52" rx="8" fill="url(#av)"/><path d="M72 26 L92 36 L72 46Z" fill="#F5F7FF"/><rect x="14" y="70" width="40" height="10" rx="3" fill="#45E5F5"/><rect x="58" y="70" width="52" height="10" rx="3" fill="#8B5CF6"/><rect x="114" y="70" width="32" height="10" rx="3" fill="#4263FF"/><rect x="14" y="84" width="132" height="6" rx="3" fill="#10485C"/><rect x="80" y="66" width="2" height="26" fill="#FF5C7A"/></svg>`,
  photo: `<svg viewBox="0 0 160 96" aria-hidden="true"><defs><linearGradient id="ap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A1B6E"/><stop offset="1" stop-color="#45E5F5"/></linearGradient></defs><rect x="30" y="8" width="100" height="80" rx="8" fill="url(#ap)"/><circle cx="104" cy="32" r="10" fill="#FFD59A"/><path d="M30 76 L62 44 L84 64 L98 52 L130 80 V88 H30Z" fill="#1B1450"/><rect x="22" y="2" width="10" height="10" rx="2" fill="none" stroke="#F5F7FF" stroke-width="2"/><rect x="128" y="84" width="10" height="10" rx="2" fill="none" stroke="#F5F7FF" stroke-width="2"/></svg>`,
  ai: `<svg viewBox="0 0 160 96" aria-hidden="true"><defs><linearGradient id="aa" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#45E5F5"/><stop offset="1" stop-color="#8B5CF6"/></linearGradient></defs><path d="M80 6 L114 48 L80 90 L46 48Z" fill="none" stroke="url(#aa)" stroke-width="5"/><path d="M80 30 L94 48 H66Z" fill="#E2C6FF"/><path d="M66 48 H94 L80 66Z" fill="#7FA2FF"/><path d="M128 18 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3Z" fill="#45E5F5"/><path d="M34 62 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2Z" fill="#8B5CF6"/></svg>`,
};

/** The « Nouveau projet » chooser: three cards + capture and resume shortcuts. */
export function openNewProject() {
  const status = h('p', { class: 'field__hint', 'aria-live': 'polite' });
  const busy = () => (status.textContent = 'Import des fichiers… l’éditeur s’ouvre dès que c’est terminé.');
  const close = () => modal.close();
  const videoInput = videoPickerInput({ onStart: busy, onOpen: close });
  const photoInput = photoPickerInput({ onStart: busy, onOpen: close });
  const card = (art, title, text, actions) =>
    h('article', { class: 'np-card' }, h('div', { class: 'np-art' }, svg(ART[art])), h('h3', {}, title), h('p', {}, text), h('div', { class: 'np-actions' }, ...actions));

  const content = h(
    'div',
    { class: 'dialog__body new-project' },
    h('h2', {}, 'Nouveau projet'),
    h('p', { class: 'field__hint' }, 'Choisissez ce que vous voulez faire. L’import ouvre directement l’éditeur.'),
    h(
      'div',
      { class: 'np-grid' },
      card('video', 'Éditer une vidéo', 'Importez une ou plusieurs vidéos, musiques ou images, puis montez-les sur la timeline.', [
        h('label', { class: 'btn btn--primary' }, icon('upload'), 'Importer des médias', videoInput),
      ]),
      card('photo', 'Éditer une photo', 'Importez une image pour la recadrer, la retoucher, ajouter du texte ou des calques.', [
        h('label', { class: 'btn btn--primary' }, icon('upload'), 'Importer une photo', photoInput),
        h('button', { class: 'btn', type: 'button', onclick: () => (close(), saveAndOpen(createProject({ name: 'Nouvelle image', type: 'photo' }))) }, 'Toile vierge'),
      ]),
      card('ai', 'Créer avec SOLVEX AI', 'Générez une image ou une vidéo à partir d’une description, avec les services d’IA connectés.', [
        h('a', { class: 'btn btn--primary', href: '/images', 'data-link': '', onclick: close }, icon('image'), 'Générer une image'),
        h('a', { class: 'btn', href: '/videos', 'data-link': '', onclick: close }, icon('video'), 'Générer une vidéo'),
      ]),
    ),
    h(
      'div',
      { class: 'np-secondary' },
      h('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => (close(), recordInto('screen')) }, '● Enregistrer l’écran'),
      h('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => (close(), recordInto('camera')) }, '● Enregistrer la webcam'),
      h('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => (close(), saveAndOpen(createProject({ name: 'Nouveau montage', type: 'video' }))) }, '＋ Projet vierge'),
      h('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => (close(), openProjectPicker()) }, '↺ Reprendre un projet'),
    ),
    status,
  );
  const modal = openModal(content, { label: 'Nouveau projet', className: 'dialog--wide' });
}

export function recordInto(mode = 'screen') {
  openRecorder({
    mode,
    onRecorded: async (meta) => {
      let project = createProject({ name: meta.name, type: 'video' });
      const track = project.tracks.find((t) => (meta.kind === 'audio' ? t.kind === 'audio' && t.role === 'voice' : t.kind === 'video' && t.name === 'Vidéo'));
      project = addClip(project, createClip(meta.kind, { mediaId: meta.id, trackId: track.id, start: 0, duration: meta.duration || 5, name: meta.name }));
      await saveAndOpen({ ...project, mediaIds: [meta.id] });
    },
  });
}

/** « Ouvrir un projet »: pick a saved project or import a .solvex file. */
export async function openProjectPicker() {
  const projects = await db.listProjects().catch(() => []);
  const fileInput = h('input', { type: 'file', accept: '.solvex,.json,application/json', hidden: true });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      const project = await importProjectFile(file);
      modal.close();
      navigate(editorPath(project));
    } catch (error) {
      toast(`Import impossible : ${error.message}`, { type: 'error' });
    }
  });
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Rechercher un projet', 'aria-label': 'Rechercher un projet' });
  const list = h('div', { class: 'picker-list' });
  const draw = () => {
    clear(list);
    const q = search.value.trim().toLowerCase();
    const items = projects.filter((p) => !q || p.name.toLowerCase().includes(q));
    if (!items.length) list.append(h('p', { class: 'field__hint' }, projects.length ? 'Aucun résultat.' : 'Aucun projet enregistré dans ce navigateur.'));
    for (const p of items) {
      list.append(
        h(
          'button',
          { class: 'picker-item', type: 'button', onclick: () => (modal.close(), navigate(editorPath(p))) },
          p.thumbnail ? h('img', { src: p.thumbnail, alt: '' }) : h('span', { class: 'lib-ph' }, icon(p.type === 'photo' ? 'image' : 'video')),
          h('span', {}, h('strong', {}, p.name), h('small', {}, `${p.type === 'photo' ? 'Photo' : 'Vidéo'} · modifié le ${formatDate(p.updatedAt)}`)),
        ),
      );
    }
  };
  search.addEventListener('input', draw);
  draw();
  const modal = openModal(
    h('div', { class: 'dialog__body' }, h('h2', {}, 'Ouvrir un projet'), search, list, h('label', { class: 'btn btn--sm' }, icon('upload'), 'Importer un fichier .solvex', fileInput)),
    { label: 'Ouvrir un projet' },
  );
  search.focus();
}

export async function importProjectFile(file) {
  const data = validateProject(JSON.parse(await file.text()));
  const embedded = data.embeddedMedia || [];
  for (const item of embedded) {
    const blob = await (await fetch(item.data)).blob();
    await db.putMedia(item.meta, blob);
  }
  delete data.embeddedMedia;
  const project = { ...data, id: uid('p'), name: `${data.name} (importé)`, updatedAt: new Date().toISOString(), saved: true };
  await db.putProject(project);
  toast(`Projet importé${embedded.length ? ` avec ${embedded.length} média(s)` : ' (sans médias : réimportez-les si besoin)'}.`, { type: 'success' });
  return project;
}

export function renameProject(project, done) {
  const input = h('input', { class: 'input', value: project.name, 'aria-label': 'Nouveau nom' });
  const form = h('form', { class: 'dialog__body' }, h('h2', {}, 'Renommer le projet'), input, h('div', { class: 'dialog__actions', style: { padding: '12px 0 0' } }, h('button', { class: 'btn btn--primary', type: 'submit' }, 'Renommer')));
  const modal = openModal(form, { label: 'Renommer le projet' });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!input.value.trim()) return;
    await db.putProject({ ...project, name: input.value.trim() });
    modal.close();
    done();
  });
  input.focus();
  input.select();
}

export async function duplicateProject(project) {
  const copy = { ...structuredClone(project), id: uid('p'), name: `${project.name} (copie)`, updatedAt: new Date().toISOString() };
  await db.putProject(copy);
  toast('Projet dupliqué.', { type: 'success', duration: 2500 });
  return copy;
}

export async function deleteProject(project) {
  const ok = await confirmDialog({ title: 'Supprimer ce projet ?', message: `« ${project.name} » sera supprimé de ce navigateur. Les médias restent dans la bibliothèque.`, confirmLabel: 'Supprimer', danger: true });
  if (ok) await db.deleteProject(project.id);
  return ok;
}

export async function exportProject(project) {
  const withMedia = await confirmDialog({ title: 'Exporter le projet', message: 'Inclure les médias dans le fichier ? (Plus lourd, mais réouvrable sur un autre appareil.)', confirmLabel: 'Inclure les médias' });
  const data = structuredClone(project);
  if (withMedia) {
    const ids = new Set([...(project.clips || []), ...(project.layers || [])].map((c) => c.mediaId).filter(Boolean));
    data.embeddedMedia = [];
    for (const id of ids) {
      const meta = await db.getMedia(id);
      const blob = await db.getBlob(id);
      if (!meta || !blob) continue;
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      data.embeddedMedia.push({ meta: { ...meta, peaks: undefined }, data: dataUrl });
    }
  }
  await saveFile(new Blob([JSON.stringify(data)], { type: 'application/json' }), `${project.name}.solvex${isStatic() ? '.json' : ''}`).catch((error) => toast(error.message, { type: 'error' }));
}

/** Project cards with a ⋯ menu (open, rename, duplicate, export, delete). */
export function projectGrid(list, { onChange, empty } = {}) {
  if (!list.length) return empty || emptyProjects();
  const grid = h('div', { class: 'project-grid' });
  for (const p of list) {
    const open = () => navigate(editorPath(p));
    const menu = h('div', { class: 'card-menu', role: 'menu', hidden: true });
    const item = (label, fn, danger) => h('button', { type: 'button', role: 'menuitem', class: danger ? 'is-danger' : '', onclick: async () => ((menu.hidden = true), await fn()) }, label);
    menu.append(
      item('Ouvrir', open),
      item('Renommer', () => renameProject(p, () => onChange?.())),
      item('Dupliquer', async () => (await duplicateProject(p), onChange?.())),
      item('Exporter (.solvex)', () => exportProject(p)),
      item('Supprimer', async () => (await deleteProject(p)) && onChange?.(), true),
    );
    const more = h('button', { class: 'card-more', type: 'button', 'aria-label': `Actions pour ${p.name}`, 'aria-haspopup': 'menu' }, '⋯');
    more.addEventListener('click', (event) => {
      event.stopPropagation();
      document.querySelectorAll('.card-menu').forEach((m) => m !== menu && (m.hidden = true));
      menu.hidden = !menu.hidden;
      if (!menu.hidden) menu.querySelector('button').focus();
    });
    const fav = h('button', { class: `lib-fav${p.favorite ? ' is-on' : ''}`, type: 'button', 'aria-label': 'Favori', 'aria-pressed': String(Boolean(p.favorite)) }, '★');
    fav.addEventListener('click', async (e) => {
      e.stopPropagation();
      p.favorite = !p.favorite;
      await db.putProject(p);
      fav.classList.toggle('is-on', p.favorite);
      fav.setAttribute('aria-pressed', String(p.favorite));
    });
    grid.append(
      h(
        'article',
        { class: 'project-card' },
        h('button', { class: 'project-thumb', type: 'button', onclick: open, 'aria-label': `Ouvrir ${p.name}` }, p.thumbnail ? h('img', { src: p.thumbnail, alt: '' }) : h('div', { class: 'lib-ph' }, icon(p.type === 'photo' ? 'image' : 'video')), h('span', { class: 'tag' }, p.type === 'photo' ? 'Photo' : 'Vidéo')),
        fav,
        h('div', { class: 'card__body' }, h('strong', {}, p.name), h('span', { class: 'card__meta' }, `Modifié le ${formatDate(p.updatedAt)}`, h('span', { class: p.saved === false ? 'save-dirty' : 'save-ok' }, p.saved === false ? '● Non enregistré' : '✓ Enregistré'))),
        h('div', { class: 'project-card__foot' }, h('button', { class: 'btn btn--sm btn--primary', type: 'button', onclick: open }, 'Ouvrir'), more, menu),
      ),
    );
  }
  return grid;
}

document.addEventListener('click', (event) => {
  if (!event.target.closest('.card-menu, .card-more')) document.querySelectorAll('.card-menu').forEach((m) => (m.hidden = true));
});

export function emptyProjects() {
  return h(
    'div',
    { class: 'empty empty--wide' },
    h('div', { class: 'empty__mark' }, logoMark({ title: '' })),
    h('h3', {}, 'Aucun projet pour le moment'),
    h('p', {}, 'Créez votre premier montage ou votre première image : tout reste enregistré dans ce navigateur.'),
    h('button', { class: 'btn btn--primary', type: 'button', onclick: () => openNewProject() }, icon('sparkles'), 'Créer mon premier projet'),
  );
}

/**
 * « Envoyer vers l’éditeur »: imports a generated file (server URL) into the
 * local library and opens it in a new or existing project.
 */
export async function sendToEditor({ url, mime, name }) {
  const projects = await db.listProjects().catch(() => []);
  const kind = mime.startsWith('video/') ? 'video' : 'image';
  const target = h(
    'select',
    { class: 'select', 'aria-label': 'Destination' },
    h('option', { value: 'new-video' }, 'Nouveau projet vidéo'),
    kind === 'image' ? h('option', { value: 'new-photo' }, 'Nouveau projet photo') : null,
    projects.filter((p) => p.type === 'video' || kind === 'image').map((p) => h('option', { value: p.id }, `${p.type === 'photo' ? 'Photo' : 'Vidéo'} — ${p.name}`)),
  );
  const go = h('button', { class: 'btn btn--primary', type: 'button' }, 'Envoyer');
  const status = h('p', { class: 'field__hint', 'aria-live': 'polite' });
  go.addEventListener('click', async () => {
    go.disabled = true;
    status.textContent = 'Import dans la bibliothèque…';
    try {
      const blob = await (await fetch(url)).blob();
      const media = await importFile(new File([blob], `${(name || 'creation').slice(0, 40)}.${mime.split('/')[1]}`, { type: mime }), { name: (name || 'Création SOLVEX').slice(0, 60), origin: 'solvex-ai' });
      let project;
      if (target.value === 'new-video') project = videoProjectFromMedia([media], { name: name?.slice(0, 40) || 'Montage IA', aspect: null });
      else if (target.value === 'new-photo') project = photoProjectFromMedia(media, { name: name?.slice(0, 40) });
      else {
        project = await db.getProject(target.value);
        if (project.type === 'photo') project = { ...project, layers: [...project.layers, photoLayer(media)] };
        else {
          const main = project.tracks.find((t) => t.kind === 'video' && !t.locked) || project.tracks[0];
          const end = Math.max(0, ...project.clips.filter((c) => c.trackId === main.id).map((c) => c.start + c.duration));
          project = addClip(project, createClip(media.kind, { mediaId: media.id, trackId: main.id, start: end, duration: media.kind === 'image' ? 5 : media.duration || 5, name: media.name }));
        }
        project = { ...project, mediaIds: [...new Set([...(project.mediaIds || []), media.id])], updatedAt: new Date().toISOString() };
      }
      modal.close();
      await saveAndOpen(project);
    } catch (error) {
      status.textContent = `Impossible d’envoyer vers l’éditeur : ${error.message}`;
      go.disabled = false;
    }
  });
  const modal = openModal(h('div', { class: 'dialog__body' }, h('h2', {}, 'Envoyer vers l’éditeur'), h('label', { class: 'field' }, h('span', { class: 'field__label' }, 'Destination'), target), h('div', { class: 'dialog__actions', style: { padding: '12px 0 0' } }, go), status), { label: 'Envoyer vers l’éditeur' });
}
