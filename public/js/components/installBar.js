import { h } from '../lib/dom.js';
import { icon } from './icons.js';
import { logoMark } from './logo.js';
import { toast } from './feedback.js';
import { canInstall, isInstalled, promptInstall, installInstructions } from '../lib/pwa.js';
import { isEmbedded } from '../lib/env.js';

/** Why one-click installation is not offered here, if a reason is known. */
function blocker() {
  if (isEmbedded()) return 'Cette version est affichée dans une page de partage (claude.ai) : l’installation n’est possible que depuis votre propre adresse SOLVEX servie en HTTPS.';
  if (!window.isSecureContext) return 'L’installation exige une connexion sécurisée (HTTPS, ou localhost sur votre ordinateur).';
  if (!('serviceWorker' in navigator)) return 'Ce navigateur ne prend pas en charge les applications web installables.';
  return null;
}

/**
 * Large « Installer SOLVEX AI sur mon appareil » bar. It uses the browser's
 * real install prompt when one is available and otherwise explains how to
 * install; it never reports an installation that did not happen.
 */
export function installBar() {
  const state = h('span', { class: 'install-bar__state' });
  const sub = h('span', { class: 'install-bar__sub' });
  const help = h('div', { class: 'install-bar__help', hidden: true, 'aria-live': 'polite' });
  const button = h(
    'button',
    { class: 'install-bar', type: 'button' },
    h('span', { class: 'install-bar__icon', 'aria-hidden': 'true' }, logoMark({ title: '' })),
    h('span', { class: 'install-bar__text' }, h('strong', {}, 'Installer SOLVEX AI sur mon appareil'), sub),
    state,
    h('span', { class: 'install-bar__go', 'aria-hidden': 'true' }, icon('download')),
  );

  const sync = () => {
    button.dataset.state = isInstalled() ? 'installed' : canInstall() ? 'ready' : 'manual';
    if (isInstalled()) {
      state.textContent = 'Installée';
      sub.textContent = 'SOLVEX AI est déjà installée sur cet appareil.';
      button.setAttribute('aria-disabled', 'true');
      help.hidden = true;
    } else if (canInstall()) {
      state.textContent = 'Prête à installer';
      sub.textContent = 'Ouvrez SOLVEX AI dans sa propre fenêtre, depuis votre bureau ou votre écran d’accueil.';
      button.removeAttribute('aria-disabled');
    } else {
      state.textContent = blocker() ? 'Indisponible ici' : 'Instructions';
      sub.textContent = blocker() || 'Votre navigateur n’a pas proposé l’installation automatique : touchez pour voir comment faire.';
      button.removeAttribute('aria-disabled');
    }
  };

  button.addEventListener('click', async () => {
    if (isInstalled()) return toast('SOLVEX AI est déjà installée sur cet appareil.', { type: 'info' });
    if (canInstall()) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') toast('Installation acceptée : SOLVEX AI s’ajoute à votre appareil.', { type: 'success' });
      else if (outcome === 'dismissed') toast('Installation annulée. Vous pourrez réessayer à tout moment.', { type: 'info' });
      sync();
      return;
    }
    help.hidden = !help.hidden;
    help.replaceChildren(
      blocker() ? h('p', {}, blocker()) : null,
      h('p', {}, h('strong', {}, 'Sur cet appareil : '), installInstructions()),
      h(
        'ul',
        { class: 'plain-list' },
        h('li', {}, 'iPhone / iPad : ouvrez SOLVEX dans Safari, bouton Partager, puis « Sur l’écran d’accueil ».'),
        h('li', {}, 'Android : Chrome, menu ⋮, puis « Installer l’application ».'),
        h('li', {}, 'Ordinateur : Chrome ou Edge, icône d’installation dans la barre d’adresse (ou menu, puis « Installer SOLVEX AI »).'),
      ),
    );
  });

  window.addEventListener('solvex:installable', sync);
  window.addEventListener('solvex:installed', sync);
  sync();
  return {
    el: h('section', { class: 'install-wrap', 'aria-label': 'Installation de l’application' }, button, help),
    cleanup: () => {
      window.removeEventListener('solvex:installable', sync);
      window.removeEventListener('solvex:installed', sync);
    },
  };
}
