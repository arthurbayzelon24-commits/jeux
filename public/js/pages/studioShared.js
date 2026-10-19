import { h, clear } from '../lib/dom.js';
import { api } from '../lib/api.js';
import { icon } from '../components/icons.js';
import { logoMark } from '../components/logo.js';
import { notice } from '../components/feedback.js';
import { mediaElement, openCreation } from '../components/creation.js';

export function providerBadge(provider) {
  if (!provider) return h('span', { class: 'tag tag--off' }, 'Aucun fournisseur');
  return provider.configured
    ? h('span', { class: 'tag tag--ok' }, `${provider.vendor} · ${provider.model}`)
    : h('span', { class: 'tag tag--off' }, `${provider.model} · non configuré`);
}

export function providerNotice(provider, what) {
  if (provider?.configured) return null;
  const missing = provider?.missing?.length ? provider.missing : ['une clé API'];
  return notice(
    'warn',
    h('p', {}, h('strong', {}, `${what} indisponible pour le moment.`), ' Le serveur n’a pas encore de fournisseur configuré.'),
    h(
      'p',
      {},
      'Ajoutez ',
      missing.map((name, i) => [i ? ', ' : '', h('code', {}, name)]),
      ' dans le fichier ',
      h('code', {}, '.env'),
      ' du serveur, puis redémarrez-le.',
    ),
  );
}

export function emptyStage({ title, text }) {
  return h('div', { class: 'empty' }, h('div', { class: 'empty__mark' }, logoMark({ title: '' })), h('h2', {}, title), h('p', {}, text));
}

/** Horizontal strip of the latest creations of a type, refreshed on demand. */
export function recentStrip(type) {
  const list = h('div', { class: 'recent__list' });
  const el = h(
    'section',
    { class: 'recent', 'aria-label': 'Créations récentes' },
    h(
      'div',
      { class: 'stage__toolbar' },
      h('h2', { class: 'stage__title' }, 'Récemment'),
      h('a', { class: 'btn btn--sm btn--ghost', href: '/galerie', 'data-link': '' }, 'Toute la galerie', icon('arrow')),
    ),
    list,
  );
  el.hidden = true;

  async function refresh() {
    try {
      const { creations } = await api.creations({ type });
      const done = creations.filter((item) => item.status === 'succeeded' && item.outputs.length).slice(0, 10);
      clear(list);
      el.hidden = done.length === 0;
      for (const item of done) {
        list.append(
          h(
            'button',
            {
              class: 'recent__item',
              type: 'button',
              'aria-label': `Ouvrir : ${item.prompt || item.operationLabel}`,
              onclick: () => openCreation(item),
            },
            mediaElement(item, item.outputs[0], { thumb: true }),
          ),
        );
      }
    } catch {
      el.hidden = true;
    }
  }
  refresh();
  return { el, refresh };
}

export function savedNote() {
  return h('span', { class: 'saved-note' }, icon('check'), 'Enregistré automatiquement dans la galerie');
}
