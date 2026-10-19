import { h } from '../lib/dom.js';
import { icon } from '../components/icons.js';
import { livingMark } from '../components/livingMark.js';
import { getCapabilities } from '../lib/state.js';
import { isStatic } from '../lib/env.js';
import { db } from '../studio/db.js';
import { openNewProject, openProjectPicker, projectGrid, emptyProjects, recordInto } from '../studio/projectActions.js';

// Prompt ideas: clicking one pre-fills the image generator (nothing is generated here).
const IDEAS = [
  { art: 'aurora', title: 'Aurore sur une cité de verre', prompt: 'Une aurore boréale au-dessus d’une ville de cristal, vue cinématique' },
  { art: 'city', title: 'Néons après la pluie', prompt: 'Rue cyberpunk au crépuscule, reflets roses et violets' },
  { art: 'orb', title: 'Le cœur du prisme', prompt: 'Sphère d’énergie lumineuse en lévitation, rendu 3D' },
  { art: 'dune', title: 'Désert de lumière', prompt: 'Dunes au coucher du soleil, palette chaude, style illustration' },
];

function providerState(caps, kind) {
  if (!caps) return h('span', { class: 'tag tag--off' }, 'Serveur injoignable');
  if (caps.static) return h('span', { class: 'tag tag--off' }, 'Nécessite le serveur SOLVEX');
  const list = caps.providers.filter((p) => p.kind === kind);
  const ready = list.find((p) => p.configured);
  if (ready) return h('span', { class: 'tag tag--ok' }, `Prêt · ${ready.vendor}`);
  return h('span', { class: 'tag tag--off' }, list.length ? 'Service à configurer' : 'Aucun service');
}

function hubCard({ art, title, text, state, action }) {
  return h(
    'article',
    { class: 'hub-card' },
    h('div', { class: `hub-card__art hub-card__art--${art}`, 'aria-hidden': 'true' }, icon(art === 'edit' ? 'layers' : art === 'video' ? 'video' : 'image', { size: 30 })),
    h('h3', {}, title),
    h('p', {}, text),
    state || null,
    action,
  );
}

export async function homePage() {
  const caps = getCapabilities();
  let projects = [];
  let storageError = null;
  try {
    projects = await db.listProjects();
  } catch (error) {
    storageError = error;
  }

  const search = h('input', { class: 'input', type: 'search', placeholder: 'Rechercher un projet', 'aria-label': 'Rechercher un projet récent' });
  const recent = h('div', { class: 'home-recent' });
  const drawRecent = () => {
    const q = search.value.trim().toLowerCase();
    const list = projects.filter((p) => !q || p.name.toLowerCase().includes(q)).slice(0, 8);
    recent.replaceChildren(
      storageError
        ? h('div', { class: 'notice notice--error' }, h('p', {}, `Stockage local indisponible : ${storageError.message}`))
        : projectGrid(list, {
            onChange: async () => {
              projects = await db.listProjects();
              drawRecent();
            },
            empty: q ? h('p', { class: 'field__hint' }, 'Aucun projet ne correspond à cette recherche.') : emptyProjects(),
          }),
    );
  };
  search.addEventListener('input', drawRecent);
  drawRecent();

  const el = h(
    'div',
    { class: 'page home' },
    h(
      'section',
      { class: 'home-hero container' },
      h(
        'div',
        { class: 'home-hero__text' },
        livingMark({ size: 'lg', title: 'SOLVEX AI' }),
        h('span', { class: 'eyebrow' }, icon('sparkles', { size: 14 }), 'Studio de création SOLVEX'),
        h('h1', { class: 'home-hero__title' }, 'Que voulez-vous ', h('span', { class: 'gradient-text' }, 'créer aujourd’hui ?')),
        h('p', { class: 'hero__lead' }, 'Montez une vidéo, retouchez une photo ou générez une image avec l’IA. Vos projets restent enregistrés dans ce navigateur.'),
        h(
          'div',
          { class: 'hero__cta' },
          h('button', { class: 'btn btn--primary btn--lg', type: 'button', onclick: () => openNewProject() }, icon('plus'), 'Nouveau projet'),
          h('button', { class: 'btn btn--lg', type: 'button', onclick: () => openProjectPicker() }, icon('upload'), 'Ouvrir un projet'),
        ),
      ),
      h('img', { class: 'home-hero__art', src: `${isStatic() ? '' : '/'}assets/hero-studio.svg`, alt: 'Illustration : un éditeur vidéo avec aperçu, panneau de propriétés et timeline', width: 640, height: 460 }),
    ),
    h(
      'section',
      { class: 'container home-section', 'aria-labelledby': 'hub-title' },
      h('h2', { class: 'home-h2', id: 'hub-title' }, 'Créer'),
      h(
        'div',
        { class: 'hub-grid' },
        hubCard({
          art: 'image',
          title: 'Générer une image',
          text: 'Décrivez une scène, choisissez un format et un style : l’image est créée par le service d’IA connecté.',
          state: providerState(caps, 'image'),
          action: h('a', { class: 'btn btn--primary', href: '/images', 'data-link': '' }, 'Générer une image', icon('arrow')),
        }),
        hubCard({
          art: 'video',
          title: 'Générer une vidéo',
          text: 'Texte vers vidéo ou animation d’une image de départ, avec suivi réel de la génération.',
          state: providerState(caps, 'video'),
          action: h('a', { class: 'btn btn--primary', href: '/videos', 'data-link': '' }, 'Générer une vidéo', icon('arrow')),
        }),
        hubCard({
          art: 'edit',
          title: 'Éditer un média',
          text: 'Importez vos vidéos ou photos et ouvrez directement l’éditeur : timeline, effets, texte, export.',
          state: h('span', { class: 'tag tag--ok' }, 'Fonctionne hors ligne'),
          action: h('button', { class: 'btn btn--primary', type: 'button', onclick: () => openNewProject() }, 'Éditer un média', icon('arrow')),
        }),
      ),
      h(
        'div',
        { class: 'home-shortcuts' },
        h('a', { class: 'chip-link', href: '/retouche', 'data-link': '' }, icon('wand', { size: 16 }), 'Retouche rapide'),
        h('button', { class: 'chip-link', type: 'button', onclick: () => recordInto('screen') }, icon('play', { size: 16 }), 'Enregistrer l’écran'),
        h('button', { class: 'chip-link', type: 'button', onclick: () => recordInto('camera') }, icon('video', { size: 16 }), 'Enregistrer la webcam'),
        h('a', { class: 'chip-link', href: '/modeles', 'data-link': '' }, icon('layers', { size: 16 }), 'Modèles de montage'),
        h('a', { class: 'chip-link', href: '/galerie', 'data-link': '' }, icon('gallery', { size: 16 }), 'Mes créations'),
      ),
    ),
    h(
      'section',
      { class: 'container home-section', 'aria-labelledby': 'recent-title' },
      h(
        'div',
        { class: 'home-head' },
        h('h2', { class: 'home-h2', id: 'recent-title' }, 'Projets récents'),
        h('div', { class: 'home-head__tools' }, search, h('a', { class: 'btn btn--sm', href: '/projets', 'data-link': '' }, `Voir tous les projets (${projects.length})`)),
      ),
      recent,
    ),
    h(
      'section',
      { class: 'container home-section', 'aria-labelledby': 'ideas-title' },
      h('h2', { class: 'home-h2', id: 'ideas-title' }, 'Idées de descriptions'),
      h('p', { class: 'field__hint' }, 'Visuels décoratifs (pas des générations). Cliquez pour reprendre l’idée dans le générateur d’images.'),
      h(
        'div',
        { class: 'idea-row' },
        IDEAS.map((idea) =>
          h(
            'a',
            { class: 'idea-card', href: `/images?prompt=${encodeURIComponent(idea.prompt)}`, 'data-link': '' },
            h('div', { class: `art art--${idea.art}`, 'aria-hidden': 'true' }),
            h('strong', {}, idea.title),
            h('em', {}, `« ${idea.prompt} »`),
          ),
        ),
      ),
    ),
  );

  return { el, title: 'Accueil' };
}
