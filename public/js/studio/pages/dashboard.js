import { h, clear, formatDate, formatBytes } from '../../lib/dom.js';
import { saveFile } from '../../lib/download.js';
import { isStatic } from '../../lib/env.js';
import { icon } from '../../components/icons.js';
import { confirmDialog, openModal, toast } from '../../components/feedback.js';
import { logoMark } from '../../components/logo.js';
import { navigate } from '../../router.js';
import { db, uid } from '../db.js';
import { createProject, projectFromTemplate, TEMPLATES, ASPECTS, validateProject, createClip, addClip } from '../project.js';
import { ACCEPT_ATTR, importFiles, deleteMedia, formatTime } from '../media.js';
import { openRecorder } from '../ui/recorder.js';

const VIEWS = [
  ['home', 'Accueil', 'sparkles'],
  ['projects', 'Projets', 'layers'],
  ['media', 'Bibliothèque', 'gallery'],
  ['favorites', 'Favoris', 'check'],
  ['templates', 'Modèles', 'image'],
];

async function saveAndOpen(project) {
  await db.putProject({ ...project, saved: true });
  navigate(`/studio/${project.type === 'photo' ? 'photo' : 'video'}?id=${project.id}`);
}

/** New project chooser: three main cards + capture shortcuts. */
export function openNewProject() {
  let aspect = '16:9';
  const aspectSel = h(
    'select',
    { class: 'select', 'aria-label': 'Format' },
    Object.entries(ASPECTS).map(([id, a]) => h('option', { value: id }, `${a.label} (${a.width}×${a.height})`)),
  );
  aspectSel.addEventListener('change', () => (aspect = aspectSel.value));
  const name = h('input', { class: 'input', placeholder: 'Nom du projet', 'aria-label': 'Nom du projet' });
  const fileInput = h('input', { type: 'file', multiple: true, accept: ACCEPT_ATTR, hidden: true });
  const photoInput = h('input', { type: 'file', accept: 'image/*', hidden: true });

  const create = async (type, files = []) => {
    let project = createProject({ name: name.value.trim() || (type === 'photo' ? 'Nouvelle image' : 'Nouveau montage'), type, aspect });
    if (files.length) {
      const { results, errors } = await importFiles(files);
      errors.forEach((e) => toast(e, { type: 'error' }));
      if (type === 'photo' && results[0]) {
        const m = results[0];
        project = {
          ...project,
          settings: { ...project.settings, aspect: 'custom', width: m.width, height: m.height },
          layers: [
            {
              id: uid('l'),
              kind: 'image',
              mediaId: m.id,
              name: m.name,
              x: 0.5,
              y: 0.5,
              scale: 1,
              rotation: 0,
              opacity: 1,
              blend: 'source-over',
              flipH: false,
              flipV: false,
              crop: { x: 0, y: 0, w: 1, h: 1 },
              adjust: {},
              hidden: false,
            },
          ],
        };
      } else if (type === 'video') {
        const main = project.tracks.find((t) => t.kind === 'video' && t.name === 'Vidéo');
        const audioTrack = project.tracks.find((t) => t.kind === 'audio' && t.role === 'music');
        let cursor = 0;
        let audioCursor = 0;
        for (const m of results) {
          if (m.kind === 'audio') {
            project = addClip(
              project,
              createClip('audio', { mediaId: m.id, trackId: audioTrack.id, start: audioCursor, duration: m.duration || 5, name: m.name }),
            );
            audioCursor += m.duration || 5;
          } else {
            const duration = m.kind === 'image' ? 5 : m.duration || 5;
            project = addClip(project, createClip(m.kind, { mediaId: m.id, trackId: main.id, start: cursor, duration, name: m.name }));
            cursor += duration;
          }
        }
      }
    }
    modal.close();
    await saveAndOpen(project);
  };
  fileInput.addEventListener('change', () => create('video', [...fileInput.files]));
  photoInput.addEventListener('change', () => create('photo', [...photoInput.files]));

  const card = (iconName, title, items, primary) =>
    h(
      'div',
      { class: 'np-card' },
      h('div', { class: 'quick-card__icon' }, icon(iconName)),
      h('h3', {}, title),
      h(
        'ul',
        {},
        items.map((i) => h('li', {}, i)),
      ),
      h('div', { class: 'np-actions' }, ...primary),
    );

  const content = h(
    'div',
    { class: 'dialog__body new-project' },
    h('h2', {}, 'Nouveau projet'),
    h('div', { class: 'grid-2' }, name, aspectSel),
    h(
      'div',
      { class: 'np-grid' },
      card(
        'image',
        'Éditer une photo',
        ['Importer et retoucher une image', 'Créer un visuel à calques', 'Utiliser une image générée par IA'],
        [
          h('label', { class: 'btn btn--primary btn--sm' }, 'Importer une photo', photoInput),
          h('button', { class: 'btn btn--sm', type: 'button', onclick: () => create('photo') }, 'Toile vierge'),
        ],
      ),
      card(
        'video',
        'Éditer une vidéo',
        ['Importer une ou plusieurs vidéos', 'Montage multipiste', 'Enregistrement d’écran ou webcam'],
        [
          h('label', { class: 'btn btn--primary btn--sm' }, 'Importer des médias', fileInput),
          h('button', { class: 'btn btn--sm', type: 'button', onclick: () => create('video') }, 'Projet vide'),
        ],
      ),
      card(
        'sparkles',
        'Créer avec SOLVEX AI',
        ['Texte → image', 'Texte → vidéo / animer une image', 'Vidéo à partir de plusieurs images (diaporama)'],
        [
          h(
            'a',
            { class: 'btn btn--primary btn--sm', href: '/images', 'data-link': '', onclick: () => modal.close() },
            'Générer une image',
          ),
          h('a', { class: 'btn btn--sm', href: '/videos', 'data-link': '', onclick: () => modal.close() }, 'Générer une vidéo'),
          h(
            'button',
            {
              class: 'btn btn--sm',
              type: 'button',
              onclick: () => (modal.close(), saveAndOpen(projectFromTemplate(TEMPLATES.find((t) => t.id === 'slideshow')))),
            },
            'Diaporama d’images',
          ),
        ],
      ),
    ),
    h(
      'div',
      { class: 'np-secondary' },
      h('span', { class: 'field__hint' }, 'Capture :'),
      h('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => (modal.close(), recordInto()) }, '● Écran / webcam'),
      h('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => (modal.close(), recordInto()) }, '🎙 Narration audio'),
    ),
  );
  const modal = openModal(content, { label: 'Nouveau projet' });
  modal.dialog.classList.add('dialog--wide');
}

function recordInto() {
  openRecorder({
    onRecorded: async (meta) => {
      let project = createProject({ name: meta.name, type: 'video' });
      const track = project.tracks.find((t) =>
        meta.kind === 'audio' ? t.kind === 'audio' && t.role === 'voice' : t.kind === 'video' && t.name === 'Vidéo',
      );
      project = addClip(
        project,
        createClip(meta.kind, { mediaId: meta.id, trackId: track.id, start: 0, duration: meta.duration || 5, name: meta.name }),
      );
      await saveAndOpen(project);
    },
  });
}

export async function dashboardPage({ params }) {
  const view = VIEWS.some(([id]) => id === params.get('view')) ? params.get('view') : 'home';
  const main = h('div', { class: 'dash-main' });
  const nav = h(
    'nav',
    { class: 'dash-nav', 'aria-label': 'Studio' },
    VIEWS.map(([id, label, ic]) =>
      h('a', { href: `/studio?view=${id}`, 'data-link': '', 'aria-current': view === id ? 'page' : null }, icon(ic), label),
    ),
    h('hr'),
    h('a', { href: '/images', 'data-link': '' }, icon('wand'), 'Génération IA'),
    h('button', { type: 'button', onclick: () => openNewProject() }, icon('image'), 'Éditeur photo'),
    h('button', { type: 'button', onclick: () => openNewProject() }, icon('video'), 'Éditeur vidéo'),
    h('button', { type: 'button', onclick: recordInto }, icon('play'), 'Enregistrement d’écran'),
    h('a', { href: '/parametres', 'data-link': '' }, icon('info'), 'Paramètres'),
  );
  const el = h('div', { class: 'page dashboard' }, nav, main);
  let projects = [];
  let media = [];
  try {
    [projects, media] = await Promise.all([db.listProjects(), db.listMedia()]);
  } catch (error) {
    main.append(h('div', { class: 'notice notice--error' }, h('p', {}, `Stockage local indisponible : ${error.message}`)));
    return { el, title: 'Studio' };
  }

  const header = (title, lead, ...actions) =>
    h(
      'header',
      { class: 'dash-head' },
      h('div', {}, h('h1', {}, title), lead ? h('p', { class: 'section__lead' }, lead) : null),
      h('div', { class: 'insp-actions' }, ...actions),
    );
  const newBtn = h(
    'button',
    { class: 'btn btn--primary', type: 'button', onclick: () => openNewProject() },
    icon('sparkles'),
    'Nouveau projet',
  );
  const importInput = h('input', { type: 'file', accept: '.solvex,.json,application/json', hidden: true });
  importInput.addEventListener('change', async () => {
    try {
      const data = validateProject(JSON.parse(await importInput.files[0].text()));
      const embedded = data.embeddedMedia || [];
      for (const item of embedded) {
        const blob = await (await fetch(item.data)).blob();
        await db.putMedia(item.meta, blob);
      }
      delete data.embeddedMedia;
      const project = { ...data, id: uid('p'), name: `${data.name} (importé)`, updatedAt: new Date().toISOString() };
      await db.putProject(project);
      toast(`Projet importé${embedded.length ? ` avec ${embedded.length} média(s)` : ' (sans médias : réimportez-les si besoin)'}.`, {
        type: 'success',
      });
      navigate(`/studio?view=projects&r=${Date.now()}`);
    } catch (error) {
      toast(`Import impossible : ${error.message}`, { type: 'error' });
    }
  });
  const openBtn = h('label', { class: 'btn' }, icon('upload'), 'Ouvrir un projet (.solvex)', importInput);

  if (view === 'home') {
    main.append(
      header(
        'Studio SOLVEX',
        'Montage vidéo, retouche photo, capture et création IA — vos projets restent dans ce navigateur.',
        newBtn,
        openBtn,
      ),
      h(
        'div',
        { class: 'quick-grid' },
        quickTile('video', 'Éditeur vidéo', 'Timeline multipiste, transitions, effets, sous-titres, export.', () => openNewProject()),
        quickTile('image', 'Éditeur photo', 'Calques, réglages, courbes, LUT, recadrage, export.', () => openNewProject()),
        quickTile('play', 'Enregistrer', 'Écran, webcam, micro : directement dans un projet.', recordInto),
      ),
      h('h2', { class: 'dash-h2' }, 'Projets récents'),
      projectGrid(projects.slice(0, 8)),
    );
  } else if (view === 'projects' || view === 'favorites') {
    const search = h('input', {
      class: 'input',
      type: 'search',
      placeholder: 'Rechercher un projet',
      'aria-label': 'Rechercher un projet',
    });
    const typeSel = h(
      'select',
      { class: 'select', 'aria-label': 'Type' },
      h('option', { value: '' }, 'Tous les types'),
      h('option', { value: 'video' }, 'Vidéo'),
      h('option', { value: 'photo' }, 'Photo'),
    );
    const grid = h('div');
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const list = projects.filter(
        (p) =>
          (view !== 'favorites' || p.favorite) && (!typeSel.value || p.type === typeSel.value) && (!q || p.name.toLowerCase().includes(q)),
      );
      grid.replaceChildren(projectGrid(list));
    };
    search.addEventListener('input', draw);
    typeSel.addEventListener('change', draw);
    main.append(
      header(view === 'favorites' ? 'Favoris' : 'Projets', `${projects.length} projet(s) dans ce navigateur.`, newBtn, openBtn),
      h('div', { class: 'dash-filters' }, search, typeSel),
      grid,
    );
    draw();
  } else if (view === 'media') {
    main.append(
      header('Bibliothèque multimédia', `${media.length} fichier(s) · ${formatBytes(media.reduce((s, m) => s + (m.size || 0), 0))}`),
      mediaManager(media),
    );
  } else if (view === 'templates') {
    const cats = [...new Set(TEMPLATES.map((t) => t.category))];
    main.append(
      header(
        'Modèles',
        'Chaque modèle crée une structure (format, emplacements, titre, transitions). Glissez vos médias sur les emplacements pour les remplacer.',
      ),
      ...cats.map((cat) =>
        h(
          'section',
          {},
          h('h2', { class: 'dash-h2' }, cat),
          h(
            'div',
            { class: 'tpl-grid' },
            TEMPLATES.filter((t) => t.category === cat).map((t) =>
              h(
                'button',
                { class: 'tpl-card', type: 'button', onclick: () => saveAndOpen(projectFromTemplate(t)) },
                h('span', { class: 'tpl-frame', style: { aspectRatio: t.aspect.replace(':', ' / ') } }, h('span', {}, t.title || t.name)),
                h('strong', {}, t.name),
                h('span', { class: 'field__hint' }, `${t.aspect} · ${t.slots} emplacements · ${formatTime(t.slots * t.slot)}`),
              ),
            ),
          ),
        ),
      ),
    );
  }
  return { el, title: 'Studio' };

  function quickTile(ic, title, text, fn) {
    return h(
      'button',
      { class: 'quick-card', type: 'button', onclick: fn },
      h('div', { class: 'quick-card__icon' }, icon(ic)),
      h('h3', {}, title),
      h('p', {}, text),
      h('span', { class: 'quick-card__go' }, 'Commencer', icon('arrow')),
    );
  }

  function projectGrid(list) {
    if (!list.length) {
      return h(
        'div',
        { class: 'empty', style: { margin: '20px auto' } },
        h('div', { class: 'empty__mark' }, logoMark({ title: '' })),
        h('h3', {}, 'Aucun projet'),
        h('p', {}, 'Créez votre premier projet pour commencer.'),
        newBtn.cloneNode(true),
      );
    }
    const grid = h('div', { class: 'project-grid' });
    for (const p of list) {
      const open = () => navigate(`/studio/${p.type === 'photo' ? 'photo' : 'video'}?id=${p.id}`);
      const fav = h(
        'button',
        {
          class: `lib-fav${p.favorite ? ' is-on' : ''}`,
          type: 'button',
          'aria-label': 'Favori',
          'aria-pressed': String(Boolean(p.favorite)),
        },
        '★',
      );
      fav.addEventListener('click', async (e) => {
        e.stopPropagation();
        p.favorite = !p.favorite;
        await db.putProject(p);
        fav.classList.toggle('is-on', p.favorite);
      });
      const menu = h(
        'div',
        { class: 'project-actions' },
        h(
          'button',
          {
            class: 'btn btn--sm btn--ghost',
            type: 'button',
            onclick: () => renameProject(p, () => navigate(`/studio?view=${view}&r=${Date.now()}`, { replace: true })),
          },
          'Renommer',
        ),
        h(
          'button',
          {
            class: 'btn btn--sm btn--ghost',
            type: 'button',
            onclick: async () => {
              await db.putProject({ ...structuredClone(p), id: uid('p'), name: `${p.name} (copie)`, updatedAt: new Date().toISOString() });
              navigate(`/studio?view=${view}&r=${Date.now()}`, { replace: true });
            },
          },
          'Dupliquer',
        ),
        h('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => exportProject(p) }, 'Exporter'),
        h(
          'button',
          {
            class: 'btn btn--sm btn--ghost',
            type: 'button',
            onclick: async () => {
              if (
                await confirmDialog({
                  title: 'Supprimer ce projet ?',
                  message: `« ${p.name} » sera supprimé de ce navigateur. Les médias restent dans la bibliothèque.`,
                  confirmLabel: 'Supprimer',
                  danger: true,
                })
              ) {
                await db.deleteProject(p.id);
                navigate(`/studio?view=${view}&r=${Date.now()}`, { replace: true });
              }
            },
          },
          'Supprimer',
        ),
      );
      grid.append(
        h(
          'article',
          { class: 'project-card' },
          h(
            'button',
            { class: 'project-thumb', type: 'button', onclick: open, 'aria-label': `Ouvrir ${p.name}` },
            p.thumbnail
              ? h('img', { src: p.thumbnail, alt: '' })
              : h('div', { class: 'lib-ph' }, icon(p.type === 'photo' ? 'image' : 'video')),
            h('span', { class: 'tag' }, p.type === 'photo' ? 'Photo' : 'Vidéo'),
            fav,
          ),
          h(
            'div',
            { class: 'card__body' },
            h('strong', {}, p.name),
            h(
              'span',
              { class: 'card__meta' },
              `Modifié le ${formatDate(p.updatedAt)}`,
              h('span', { class: p.saved === false ? 'save-dirty' : 'save-ok' }, p.saved === false ? '● Non enregistré' : '✓ Enregistré'),
            ),
          ),
          menu,
        ),
      );
    }
    return grid;
  }
}

function renameProject(project, done) {
  const input = h('input', { class: 'input', value: project.name, 'aria-label': 'Nouveau nom' });
  const ok = h('button', { class: 'btn btn--primary', type: 'submit' }, 'Renommer');
  const form = h(
    'form',
    { class: 'dialog__body' },
    h('h2', {}, 'Renommer le projet'),
    input,
    h('div', { class: 'dialog__actions', style: { padding: '12px 0 0' } }, ok),
  );
  const modal = openModal(form, { label: 'Renommer le projet' });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!input.value.trim()) return;
    project.name = input.value.trim();
    await db.putProject(project);
    modal.close();
    done();
  });
  input.focus();
  input.select();
}

async function exportProject(project) {
  const withMedia = await confirmDialog({
    title: 'Exporter le projet',
    message: 'Inclure les médias dans le fichier .solvex ? (Fichier plus lourd, mais réouvrable sur un autre appareil.)',
    confirmLabel: 'Inclure les médias',
  });
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
  await saveFile(
    new Blob([JSON.stringify(data)], { type: 'application/json' }),
    `${project.name}.solvex${isStatic() ? '.json' : ''}`,
  ).catch((error) => toast(error.message, { type: 'error' }));
}

function mediaManager(media) {
  const input = h('input', { type: 'file', multiple: true, accept: ACCEPT_ATTR, hidden: true });
  const status = h('p', { class: 'field__hint', 'aria-live': 'polite' });
  const grid = h('div', { class: 'project-grid' });
  const search = h('input', {
    class: 'input',
    type: 'search',
    placeholder: 'Rechercher (nom ou type : vidéo, image, audio)',
    'aria-label': 'Rechercher un média',
  });
  const kindSel = h(
    'select',
    { class: 'select', 'aria-label': 'Type' },
    h('option', { value: '' }, 'Tous'),
    h('option', { value: 'video' }, 'Vidéos'),
    h('option', { value: 'image' }, 'Images'),
    h('option', { value: 'audio' }, 'Audio'),
    h('option', { value: 'fav' }, '★ Favoris'),
  );
  const draw = () => {
    clear(grid);
    const q = search.value.trim().toLowerCase();
    const aliases = { vidéo: 'video', video: 'video', image: 'image', photo: 'image', audio: 'audio', son: 'audio' };
    const list = media.filter(
      (m) =>
        (kindSel.value === 'fav' ? m.favorite : !kindSel.value || m.kind === kindSel.value) &&
        (!q || m.name.toLowerCase().includes(q) || aliases[q] === m.kind),
    );
    if (!list.length) grid.append(h('p', { class: 'field__hint' }, 'Aucun média.'));
    for (const m of list) {
      grid.append(
        h(
          'article',
          { class: 'project-card' },
          h(
            'div',
            { class: 'project-thumb' },
            m.thumb ? h('img', { src: m.thumb, alt: '' }) : h('div', { class: 'lib-ph' }, icon(m.kind === 'audio' ? 'play' : 'image')),
            h('span', { class: 'tag' }, m.kind),
          ),
          h(
            'div',
            { class: 'card__body' },
            h('strong', {}, m.name),
            h(
              'span',
              { class: 'card__meta' },
              [
                m.duration ? formatTime(m.duration) : '',
                m.width ? `${m.width}×${m.height}` : '',
                formatBytes(m.size),
                formatDate(m.createdAt),
              ]
                .filter(Boolean)
                .join(' · '),
            ),
          ),
          h(
            'div',
            { class: 'project-actions' },
            h(
              'button',
              {
                class: 'btn btn--sm btn--ghost',
                type: 'button',
                onclick: async () => {
                  m.favorite = !m.favorite;
                  await db.updateMedia(m);
                  draw();
                },
              },
              m.favorite ? '★ Favori' : '☆ Favori',
            ),
            h(
              'button',
              {
                class: 'btn btn--sm btn--ghost',
                type: 'button',
                onclick: async () => {
                  if (
                    await confirmDialog({
                      title: 'Supprimer ce média ?',
                      message: `« ${m.name} » sera supprimé. Les projets qui l’utilisent afficheront un clip vide.`,
                      confirmLabel: 'Supprimer',
                      danger: true,
                    })
                  ) {
                    await deleteMedia(m.id);
                    media.splice(media.indexOf(m), 1);
                    draw();
                  }
                },
              },
              'Supprimer',
            ),
          ),
        ),
      );
    }
  };
  input.addEventListener('change', async () => {
    const { results, errors } = await importFiles([...input.files], (i, n, name) => (status.textContent = `Import ${i}/${n} : ${name}`));
    errors.forEach((e) => toast(e, { type: 'error' }));
    media.unshift(...results);
    status.textContent = `${results.length} fichier(s) importé(s).`;
    draw();
  });
  search.addEventListener('input', draw);
  kindSel.addEventListener('change', draw);
  draw();
  return h(
    'div',
    {},
    h('div', { class: 'dash-filters' }, h('label', { class: 'btn btn--primary' }, icon('upload'), 'Importer', input), search, kindSel),
    status,
    grid,
  );
}
