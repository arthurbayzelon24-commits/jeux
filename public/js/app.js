import { h } from './lib/dom.js';
import { api, onConnectivity } from './lib/api.js';
import { getCapabilities as getCapabilitiesSafe, loadCapabilities } from './lib/state.js';
import { defineRoutes, render, navigate } from './router.js';
import { playIntro } from './components/intro.js';
import { logoMark } from './components/logo.js';
import { icon } from './components/icons.js';
import { setBusy, toast } from './components/feedback.js';
import { homePage } from './pages/home.js';
import { imagesPage } from './pages/images.js';
import { videosPage } from './pages/videos.js';
import { enhancePage } from './pages/enhance.js';
import { galleryPage } from './pages/gallery.js';
import { emptyStage } from './pages/studioShared.js';
import { dashboardPage } from './studio/pages/dashboard.js';
import { videoEditorPage } from './studio/pages/videoEditor.js';
import { photoEditorPage } from './studio/pages/photoEditor.js';
import { settingsPage } from './pages/settings.js';
import { applyPrefs, getPrefs } from './lib/prefs.js';
import { initPwa } from './lib/pwa.js';
import { isStatic } from './lib/env.js';
import { setCapabilities } from './lib/state.js';

const NAV = [
  { path: '/studio', label: 'Studio' },
  { path: '/images', label: 'Images' },
  { path: '/videos', label: 'Vidéos' },
  { path: '/retouche', label: 'Retouche' },
  { path: '/galerie', label: 'Galerie' },
  { path: '/parametres', label: 'Paramètres' },
];

// Capabilities shown by the public static build (no Node server behind it).
const STATIC_CAPABILITIES = {
  static: true,
  providers: [],
  styles: [
    ['realiste', 'Réaliste'],
    ['cinematique', 'Cinématique'],
    ['anime', 'Anime'],
    ['illustration', 'Illustration'],
    ['3d', '3D'],
    ['fantaisie', 'Fantaisie'],
    ['cyberpunk', 'Cyberpunk'],
    ['artistique', 'Artistique'],
    ['photographie', 'Photographie'],
    ['publicite', 'Publicité'],
    ['personnalise', 'Personnalisé'],
  ].map(([id, label]) => ({ id, label })),
  promptEnhancement: { method: 'local' },
  limits: { maxUploadBytes: 20 * 1024 * 1024, maxPromptLength: 4000 },
  editOperations: [],
  transcription: null,
};

function notFoundPage() {
  return {
    title: 'Page introuvable',
    el: h(
      'div',
      { class: 'page container', style: { padding: '80px 0' } },
      h('h1', { class: 'sr-only' }, 'Page introuvable'),
      emptyStage({ title: 'Cette page n’existe pas', text: 'Le lien est peut-être incomplet.' }),
      h(
        'div',
        { class: 'hero__cta', style: { justifyContent: 'center' } },
        h('a', { class: 'btn btn--primary', href: '/', 'data-link': '' }, 'Retour à l’accueil'),
      ),
    ),
  };
}

let session = { authRequired: false, authenticated: true };

function loginPage() {
  const input = h('input', { class: 'input', type: 'password', id: 'access-code', autocomplete: 'current-password', required: true });
  const submit = h('button', { class: 'btn btn--primary btn--block', type: 'submit' }, icon('lock'), 'Entrer dans le studio');
  const form = h(
    'form',
    { class: 'panel' },
    h('div', { style: { width: '72px', margin: '0 auto' } }, logoMark()),
    h('h1', { style: { margin: 0, fontSize: '24px' } }, 'Accès au studio'),
    h('p', { class: 'field__hint' }, 'Cette instance SOLVEX AI est protégée par un code d’accès.'),
    h('label', { class: 'sr-only', for: 'access-code' }, 'Code d’accès'),
    input,
    submit,
  );
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setBusy(submit, true);
    try {
      await api.login(input.value);
      session = { authRequired: true, authenticated: true };
      await loadCapabilities({ force: true });
      renderHeaderStatus(getCapabilitiesSafe());
      navigate('/', { replace: true });
      render();
    } catch (error) {
      toast(error.message, { type: 'error' });
      setBusy(submit, false);
    }
  });
  return { title: 'Connexion', el: h('div', { class: 'login page' }, form) };
}

let statusEl;
function renderHeaderStatus(capabilities) {
  if (!statusEl) return;
  if (!capabilities) {
    statusEl.dataset.state = 'off';
    statusEl.lastChild.textContent = 'Hors ligne';
    return;
  }
  if (capabilities.static) {
    statusEl.dataset.state = 'partial';
    statusEl.lastChild.textContent = 'Version sans serveur';
    statusEl.title = 'Le studio de montage fonctionne entièrement dans le navigateur. La génération IA nécessite le serveur SOLVEX.';
    return;
  }
  const configured = capabilities.providers.filter((p) => p.configured).length;
  statusEl.dataset.state = configured === capabilities.providers.length ? 'ok' : configured > 0 ? 'partial' : 'off';
  statusEl.lastChild.textContent =
    configured === capabilities.providers.length
      ? 'Fournisseurs connectés'
      : configured > 0
        ? 'Configuration partielle'
        : 'Aucun fournisseur';
  statusEl.title = capabilities.providers
    .map((p) => `${p.label} : ${p.configured ? 'connecté' : `manque ${p.missing.join(', ')}`}`)
    .join('\n');
}

function buildHeader() {
  const nav = h(
    'nav',
    { class: 'nav', id: 'main-nav', 'aria-label': 'Navigation principale' },
    NAV.map((item) => h('a', { href: item.path, 'data-link': '' }, item.label)),
  );
  const toggle = h(
    'button',
    {
      class: 'btn btn--icon btn--ghost menu-toggle',
      type: 'button',
      'aria-label': 'Menu',
      'aria-expanded': 'false',
      'aria-controls': 'main-nav',
    },
    icon('menu'),
  );
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
  statusEl = h('span', { class: 'status-dot', 'aria-live': 'polite' }, h('span', {}, 'Connexion…'));

  const header = h(
    'header',
    { class: 'site-header' },
    h(
      'a',
      { class: 'brand', href: '/', 'data-link': '', 'aria-label': 'SOLVEX AI, accueil' },
      logoMark({ title: '' }),
      h('span', { class: 'brand__word' }, 'SOLVEX ', h('span', { class: 'brand__ai' }, 'AI')),
    ),
    nav,
    h(
      'div',
      { class: 'header__actions' },
      statusEl,
      h(
        'a',
        { class: 'btn btn--primary btn--sm btn--create', href: '/studio', 'data-link': '', 'aria-label': 'Créer' },
        icon('sparkles'),
        h('span', {}, 'Créer'),
      ),
      toggle,
    ),
  );
  return { header, nav };
}

function buildOfflineBanner() {
  const retry = h('button', { class: 'btn btn--sm', type: 'button' }, icon('refresh'), 'Réessayer');
  const banner = h(
    'div',
    { class: 'offline-banner', role: 'alert', hidden: true },
    icon('alert', { size: 18 }),
    h(
      'span',
      {},
      'Le serveur SOLVEX est injoignable. Les créations déjà affichées restent consultables ; les nouvelles générations reprendront dès le retour de la connexion.',
    ),
    retry,
  );
  retry.addEventListener('click', async () => {
    setBusy(retry, true);
    try {
      const caps = await loadCapabilities({ force: true });
      renderHeaderStatus(caps);
      render();
    } catch {
      // The banner stays visible.
    } finally {
      setBusy(retry, false);
    }
  });
  onConnectivity((online) => {
    banner.hidden = online;
  });
  return banner;
}

async function boot() {
  applyPrefs();
  const prefs = getPrefs();
  const intro = prefs.showIntro ? playIntro() : { track: (promise) => promise, done: () => {} };
  const { header, nav } = buildHeader();
  const main = h('main', { id: 'contenu' });
  const footer = h(
    'footer',
    { class: 'site-footer' },
    h(
      'div',
      { class: 'container' },
      h('span', {}, '© ', String(new Date().getFullYear()), ' SOLVEX AI — studio créatif génératif'),
      h('span', {}, 'Studio de montage local · génération selon les fournisseurs d’IA configurés'),
      h('a', { href: '/parametres?section=version', 'data-link': '' }, 'Version et mises à jour'),
    ),
  );
  document.getElementById('app').replaceChildren(header, buildOfflineBanner(), main, footer);

  const highlight = (path) => {
    for (const link of nav.querySelectorAll('a')) {
      const href = link.getAttribute('href');
      if (href === path || (href === '/studio' && path.startsWith('/studio'))) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  };

  if (!isStatic()) {
    try {
      session = await intro.track(api.session(), 'Connexion au serveur');
    } catch {
      // Offline: keep going so the interface stays usable.
    }
  }

  const guard = (page) => (ctx) => (session.authRequired && !session.authenticated ? loginPage() : page(ctx));
  defineRoutes(
    {
      '/': guard(homePage),
      '/images': guard(imagesPage),
      '/videos': guard(videosPage),
      '/retouche': guard(enhancePage),
      '/galerie': guard(galleryPage),
      '/studio': guard(dashboardPage),
      '/studio/video': guard(videoEditorPage),
      '/studio/photo': guard(photoEditorPage),
      '/parametres': guard(settingsPage),
      '*': notFoundPage,
    },
    { root: main, afterNavigate: highlight },
  );
  window.addEventListener('solvex:auth-required', () => {
    session = { authRequired: true, authenticated: false };
    render();
  });

  if (isStatic()) {
    setCapabilities(STATIC_CAPABILITIES);
    renderHeaderStatus(STATIC_CAPABILITIES);
  } else if (!session.authRequired || session.authenticated) {
    try {
      renderHeaderStatus(await intro.track(loadCapabilities(), 'Lecture des capacités des modèles'));
    } catch {
      renderHeaderStatus(null);
    }
  } else {
    statusEl.dataset.state = 'partial';
    statusEl.lastChild.textContent = 'Connexion requise';
  }
  await intro.track(render(), 'Préparation du studio');
  intro.done();
  initPwa();
}

boot();
