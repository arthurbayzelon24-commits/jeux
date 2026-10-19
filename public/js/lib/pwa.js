import { h } from './dom.js';
import { APP_VERSION, isStatic } from './env.js';
import { openModal } from '../components/feedback.js';

/**
 * Installation and updates.
 * - With a service worker (HTTPS / localhost): a new version downloads in the
 *   background and waits; the user sees its name and notes and decides to
 *   install it now or later.
 * - Without one (static link, plain HTTP): the same prompt is driven by
 *   polling /updates/index.json; installing reloads the page.
 */
let deferredInstall = null;
let registration = null;
const DISMISS_KEY = 'solvex:update-dismissed';

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstall = event;
  window.dispatchEvent(new CustomEvent('solvex:installable'));
});
window.addEventListener('appinstalled', () => {
  deferredInstall = null;
});

export const canInstall = () => Boolean(deferredInstall);
export const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export async function promptInstall() {
  if (!deferredInstall) return 'unavailable';
  deferredInstall.prompt();
  const { outcome } = await deferredInstall.userChoice;
  deferredInstall = null;
  return outcome;
}

export function installInstructions() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'Sur iPhone / iPad (Safari) : touchez le bouton Partager, puis « Sur l’écran d’accueil ».';
  if (/Android/.test(ua)) return 'Sur Android (Chrome) : menu ⋮ → « Installer l’application » ou « Ajouter à l’écran d’accueil ».';
  if (/Edg\//.test(ua)) return 'Sur Edge : menu … → Applications → « Installer SOLVEX AI ».';
  if (/Firefox/.test(ua))
    return 'Firefox pour ordinateur n’installe pas les applications web : utilisez Chrome ou Edge, ou ajoutez un marque-page.';
  if (/Chrome/.test(ua)) return 'Sur Chrome : icône d’installation dans la barre d’adresse, ou menu ⋮ → « Installer SOLVEX AI ».';
  if (/Safari/.test(ua)) return 'Sur Safari (macOS) : menu Fichier → « Ajouter au Dock ».';
  return 'Utilisez le menu de votre navigateur : « Installer » ou « Ajouter à l’écran d’accueil ».';
}

export function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

const base = () => (isStatic() ? '' : '/');

export async function fetchReleases() {
  const index = await fetch(`${base()}updates/index.json?t=${Date.now()}`, { cache: 'no-store' }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
  const releases = await Promise.all(
    index.releases.map((v) =>
      fetch(`${base()}updates/${v}.json?t=${Date.now()}`, { cache: 'no-store' }).then((r) =>
        r.ok ? r.json() : { version: v, name: '', notes: [] },
      ),
    ),
  );
  return { latest: index.latest, releases };
}

function showUpdatePrompt(release, install) {
  const now = h('button', { class: 'btn btn--primary', type: 'button' }, 'Installer maintenant');
  const later = h('button', { class: 'btn btn--ghost', type: 'button' }, 'Plus tard');
  const modal = openModal(
    h(
      'div',
      { class: 'dialog__body' },
      h('span', { class: 'eyebrow' }, 'Mise à jour disponible'),
      h('h2', {}, `SOLVEX AI ${release.version}${release.name ? ` — « ${release.name} »` : ''}`),
      h(
        'p',
        { class: 'field__hint' },
        `Version actuelle : ${APP_VERSION}${release.date ? ` · publiée le ${new Date(release.date).toLocaleDateString('fr-FR')}` : ''}`,
      ),
      h(
        'ul',
        { class: 'update-notes' },
        (release.notes || []).map((n) => h('li', {}, n)),
      ),
      h(
        'p',
        { class: 'field__hint' },
        'Vos projets et médias sont conservés. Vous pouvez aussi l’installer plus tard depuis Paramètres → Version.',
      ),
      h('div', { class: 'dialog__actions', style: { padding: '12px 0 0' } }, later, now),
    ),
    { label: 'Mise à jour disponible' },
  );
  now.addEventListener('click', () => {
    modal.close();
    install();
  });
  later.addEventListener('click', () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, release.version);
    } catch {
      /* ignore */
    }
    modal.close();
  });
}

/** Checks for a newer version. `manual` = triggered by the user (always reports). */
export async function checkForUpdates({ manual = false } = {}) {
  if (registration) await registration.update().catch(() => {});
  if (registration?.waiting) {
    await promptWaiting(registration.waiting, manual);
    return 'available';
  }
  let info;
  try {
    info = await fetchReleases();
  } catch {
    return 'error';
  }
  if (compareVersions(info.latest, APP_VERSION) <= 0) return 'up-to-date';
  if (!manual && sessionStorage.getItem(DISMISS_KEY) === info.latest) return 'available';
  const release = info.releases.find((r) => r.version === info.latest) || { version: info.latest, notes: [] };
  // Without a waiting service worker, installing means reloading fresh files.
  showUpdatePrompt(release, () => location.reload());
  return 'available';
}

async function promptWaiting(worker, manual) {
  let release = { version: 'nouvelle version', notes: [] };
  try {
    const info = await fetchReleases();
    release = info.releases.find((r) => r.version === info.latest) || release;
    if (compareVersions(info.latest, APP_VERSION) <= 0)
      release = {
        version: `${APP_VERSION} (correctifs)`,
        name: 'Mise à jour des fichiers',
        notes: ['Fichiers de l’application actualisés.'],
      };
  } catch {
    /* show a generic prompt */
  }
  if (!manual && sessionStorage.getItem(DISMISS_KEY) === release.version) return;
  showUpdatePrompt(release, () => worker.postMessage({ type: 'SKIP_WAITING' }));
}

export async function initPwa() {
  if (isStatic() || !('serviceWorker' in navigator) || !window.isSecureContext) {
    setTimeout(() => checkForUpdates(), 4000);
    setInterval(() => checkForUpdates(), 30 * 60 * 1000);
    return;
  }
  try {
    registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return;
  }
  let refreshing = false;
  // First visit: the worker claiming the page is not an update, so no reload
  // (it would close whatever the user had just opened).
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing || !hadController) return;
    refreshing = true;
    location.reload();
  });
  const watch = (worker) => {
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) promptWaiting(worker, false);
    });
  };
  if (registration.waiting && navigator.serviceWorker.controller) promptWaiting(registration.waiting, false);
  registration.addEventListener('updatefound', () => registration.installing && watch(registration.installing));
  setInterval(() => registration.update().catch(() => {}), 30 * 60 * 1000);
}
