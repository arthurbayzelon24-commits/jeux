import { h } from '../lib/dom.js';
import { icon } from '../components/icons.js';
import { getCapabilities } from '../lib/state.js';
import { downloadUrl, openCreation } from '../components/creation.js';
import { openNewProject, sendToEditor } from '../studio/projectActions.js';

/** Image / Vidéo / Éditer switch shown at the top of the creation pages. */
export function modeSwitch(active) {
  return h(
    'nav',
    { class: 'mode-switch', 'aria-label': 'Type de création' },
    h('a', { href: '/images', 'data-link': '', 'aria-current': active === 'image' ? 'page' : null }, icon('image', { size: 16 }), 'Générer une image'),
    h('a', { href: '/videos', 'data-link': '', 'aria-current': active === 'video' ? 'page' : null }, icon('video', { size: 16 }), 'Générer une vidéo'),
    h('button', { type: 'button', onclick: () => openNewProject() }, icon('layers', { size: 16 }), 'Éditer un média'),
  );
}

/**
 * Field contents kept for the browser session, so going to another page and
 * back does not lose the prompt. Nothing secret is stored here.
 */
export function draft(kind) {
  const key = `solvex:draft:${kind}`;
  let data = {};
  try {
    data = JSON.parse(sessionStorage.getItem(key) || '{}') || {};
  } catch {
    data = {};
  }
  return {
    data,
    save(patch) {
      Object.assign(data, patch);
      try {
        sessionStorage.setItem(key, JSON.stringify(data));
      } catch {
        // Storage full or blocked: the fields simply are not restored.
      }
    },
  };
}

/** Configured provider chosen by the user for a kind, falling back to the default one. */
export function chosenProvider(kind, wantedId) {
  const list = (getCapabilities()?.providers || []).filter((p) => p.kind === kind);
  return list.find((p) => p.id === wantedId && p.configured) || list.find((p) => p.configured) || list[0] || null;
}

/** Model selector, shown only when there is something to choose. */
export function modelSelect(kind, current, onChange) {
  const list = (getCapabilities()?.providers || []).filter((p) => p.kind === kind);
  if (list.filter((p) => p.configured).length < 2) return null;
  const id = `model-${kind}`;
  const select = h(
    'select',
    { class: 'select', id },
    list.map((p) =>
      h('option', { value: p.id, disabled: !p.configured, selected: p.id === current?.id }, `${p.vendor} · ${p.model}${p.configured ? '' : ' (à configurer)'}`),
    ),
  );
  select.addEventListener('change', () => onChange(select.value));
  return h('div', { class: 'field' }, h('label', { class: 'field__label', for: id }, 'Modèle'), select);
}

/** Banner shown while the browser is offline: generation needs the network. */
export function offlineNotice() {
  const el = h(
    'div',
    { class: 'notice notice--offline', role: 'status' },
    icon('alert'),
    h('p', {}, h('strong', {}, 'Vous êtes hors ligne. '), 'La génération par IA a besoin d’une connexion Internet ; le montage et la retouche locale restent disponibles.'),
  );
  const sync = () => (el.hidden = navigator.onLine);
  sync();
  window.addEventListener('online', sync);
  window.addEventListener('offline', sync);
  return { el, cleanup: () => (window.removeEventListener('online', sync), window.removeEventListener('offline', sync)) };
}

/** Actions under a finished generation. */
export function resultActions(creation, { onRegenerate, onEditPrompt }) {
  const output = creation.outputs[0];
  return h(
    'div',
    { class: 'result-bar__actions' },
    h('button', { class: 'btn btn--sm', type: 'button', onclick: () => openCreation(creation) }, icon('expand'), 'Ouvrir en grand'),
    creation.outputs.length === 1
      ? h('a', { class: 'btn btn--sm', href: downloadUrl(output), download: '' }, icon('download'), 'Télécharger')
      : null,
    h('button', { class: 'btn btn--sm', type: 'button', onclick: onRegenerate }, icon('refresh'), 'Régénérer'),
    h('button', { class: 'btn btn--sm', type: 'button', onclick: onEditPrompt }, icon('brush'), 'Modifier la description'),
    h(
      'button',
      { class: 'btn btn--sm btn--primary', type: 'button', onclick: () => sendToEditor({ url: output.url, mime: output.mime, name: creation.prompt || creation.operationLabel }) },
      icon('layers'),
      'Envoyer vers l’éditeur',
    ),
  );
}

/** Notice for providers that forward the prompt to a third-party service. */
export function thirdPartyNotice(provider) {
  if (!provider?.capabilities?.thirdParty) return null;
  return h('p', { class: 'third-party' }, icon('info', { size: 15 }), provider.capabilities.notes?.[0] || `Votre description est envoyée à ${provider.vendor}.`);
}
