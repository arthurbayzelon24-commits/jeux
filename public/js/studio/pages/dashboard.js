import { h, clear, formatDate, formatBytes } from '../../lib/dom.js';
import { icon } from '../../components/icons.js';
import { confirmDialog, toast } from '../../components/feedback.js';
import { db } from '../db.js';
import { projectFromTemplate, TEMPLATES } from '../project.js';
import { ACCEPT_ATTR, importFiles, deleteMedia, formatTime } from '../media.js';
import { openNewProject, openProjectPicker, projectGrid, saveAndOpen, videoProjectFromMedia, photoProjectFromMedia } from '../projectActions.js';

const VIEWS = [
  ['projects', '/projets', 'Projets', 'folder'],
  ['favorites', '/projets?filtre=favoris', 'Favoris', 'check'],
  ['media', '/bibliotheque', 'Bibliothèque', 'gallery'],
  ['templates', '/modeles', 'Modèles', 'layers'],
];

/** Projects, library and templates pages (routes /projets, /bibliotheque, /modeles). */
export function dashboardPage(view) {
  return async ({ params }) => {
    if (view === 'projects' && params.get('filtre') === 'favoris') view = 'favorites';
    return renderDashboard(view);
  };
}

async function renderDashboard(view) {
  const main = h('div', { class: 'dash-main' });
  const nav = h(
    'nav',
    { class: 'dash-nav', 'aria-label': 'Projets et bibliothèque' },
    VIEWS.map(([id, href, label, ic]) => h('a', { href, 'data-link': '', 'aria-current': view === id ? 'page' : null }, icon(ic), label)),
  );
  const el = h('div', { class: 'page dashboard container' }, nav, main);
  let projects = [];
  let media = [];
  try {
    [projects, media] = await Promise.all([db.listProjects(), db.listMedia()]);
  } catch (error) {
    main.append(h('div', { class: 'notice notice--error' }, h('p', {}, `Stockage local indisponible : ${error.message}`)));
    return { el, title: 'Projets' };
  }

  const header = (title, lead, ...actions) =>
    h('header', { class: 'dash-head' }, h('div', {}, h('h1', {}, title), lead ? h('p', { class: 'section__lead' }, lead) : null), h('div', { class: 'insp-actions' }, ...actions));
  const newBtn = h('button', { class: 'btn btn--primary', type: 'button', onclick: () => openNewProject() }, icon('plus'), 'Nouveau projet');
  const openBtn = h('button', { class: 'btn', type: 'button', onclick: () => openProjectPicker() }, icon('upload'), 'Ouvrir un projet');

  if (view === 'projects' || view === 'favorites') {
    const search = h('input', { class: 'input', type: 'search', placeholder: 'Rechercher un projet', 'aria-label': 'Rechercher un projet' });
    const typeSel = h('select', { class: 'select', 'aria-label': 'Type' }, h('option', { value: '' }, 'Tous les types'), h('option', { value: 'video' }, 'Vidéo'), h('option', { value: 'photo' }, 'Photo'));
    const sortSel = h('select', { class: 'select', 'aria-label': 'Trier' }, h('option', { value: 'date' }, 'Plus récents'), h('option', { value: 'name' }, 'Nom (A→Z)'));
    const grid = h('div');
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const list = projects
        .filter((p) => (view !== 'favorites' || p.favorite) && (!typeSel.value || p.type === typeSel.value) && (!q || p.name.toLowerCase().includes(q)))
        .sort((a, b) => (sortSel.value === 'name' ? a.name.localeCompare(b.name, 'fr') : 0));
      const filtered = q || typeSel.value || view === 'favorites';
      grid.replaceChildren(
        projectGrid(list, {
          onChange: async () => {
            projects = await db.listProjects();
            draw();
          },
          empty: filtered && projects.length ? h('p', { class: 'field__hint' }, view === 'favorites' && !q ? 'Aucun favori : touchez ★ sur un projet pour l’ajouter ici.' : 'Aucun projet ne correspond.') : undefined,
        }),
      );
    };
    search.addEventListener('input', draw);
    typeSel.addEventListener('change', draw);
    sortSel.addEventListener('change', draw);
    main.append(header(view === 'favorites' ? 'Projets favoris' : 'Mes projets', `${projects.length} projet(s) enregistré(s) dans ce navigateur.`, newBtn, openBtn), h('div', { class: 'dash-filters' }, search, typeSel, sortSel), grid);
    draw();
  } else if (view === 'media') {
    main.append(header('Bibliothèque', `${media.length} fichier(s) · ${formatBytes(media.reduce((s, m) => s + (m.size || 0), 0))} stockés dans ce navigateur`), mediaManager(media));
  } else {
    const cats = [...new Set(TEMPLATES.map((t) => t.category))];
    main.append(
      header('Modèles', 'Chaque modèle crée une structure (format, emplacements, titre, transitions). Glissez vos médias sur les emplacements pour les remplacer.'),
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
  return { el, title: { projects: 'Mes projets', favorites: 'Favoris', media: 'Bibliothèque', templates: 'Modèles' }[view] };
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
                class: 'btn btn--sm btn--primary',
                type: 'button',
                onclick: () => saveAndOpen(m.kind === 'image' ? photoProjectFromMedia(m) : videoProjectFromMedia([m], { name: m.name.replace(/\.[^.]+$/, ''), aspect: null })),
              },
              m.kind === 'image' ? 'Retoucher' : 'Monter',
            ),
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
