import { h, clear, formatDate } from '../lib/dom.js';
import { api } from '../lib/api.js';
import { icon } from '../components/icons.js';
import { confirmDialog, notice, toast } from '../components/feedback.js';
import { downloadUrl, mediaElement, openCreation, regenerateFrom, statusTag } from '../components/creation.js';
import { emptyStage } from './studioShared.js';
import { sendToEditor } from '../studio/projectActions.js';

const FILTERS = [
  { id: '', label: 'Tout' },
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Vidéos' },
];

function readPref(key, fallback) {
  try {
    return localStorage.getItem(`solvex:${key}`) ?? fallback;
  } catch {
    return fallback;
  }
}
function writePref(key, value) {
  try {
    localStorage.setItem(`solvex:${key}`, value);
  } catch {
    // Preferences are a convenience only.
  }
}

export function galleryPage() {
  let type = readPref('gallery-type', '');
  let sort = readPref('gallery-sort', 'desc');
  let poll = null;
  let alive = true;

  const grid = h('div', { class: 'gallery-grid', 'aria-live': 'polite' });
  const countEl = h('span', { class: 'field__hint' });

  const filterGroup = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': 'Filtrer par type' });
  for (const filter of FILTERS) {
    const input = h('input', { type: 'radio', name: 'gallery-type', value: filter.id, checked: filter.id === type });
    input.addEventListener('change', () => {
      type = filter.id;
      writePref('gallery-type', type);
      load();
    });
    filterGroup.append(h('label', { class: 'chip' }, input, h('span', {}, filter.label)));
  }
  const sortSelect = h(
    'select',
    { class: 'select', 'aria-label': 'Trier par date', style: { width: 'auto', padding: '9px 40px 9px 14px' } },
    h('option', { value: 'desc', selected: sort === 'desc' }, 'Plus récentes'),
    h('option', { value: 'asc', selected: sort === 'asc' }, 'Plus anciennes'),
  );
  sortSelect.addEventListener('change', () => {
    sort = sortSelect.value;
    writePref('gallery-sort', sort);
    load();
  });

  async function remove(creation, modal) {
    const ok = await confirmDialog({
      title: 'Supprimer cette création ?',
      message: 'Le fichier sera définitivement supprimé du serveur. Cette action est irréversible.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.remove(creation.id);
      modal?.close();
      toast('Création supprimée.', { type: 'success', duration: 2500 });
      load();
    } catch (error) {
      toast(error.message, { type: 'error' });
    }
  }

  async function retry(creation) {
    try {
      await api.retry(creation.id);
      toast('Génération relancée.', { type: 'info', duration: 2500 });
      load();
    } catch (error) {
      toast(error.message, { type: 'error' });
    }
  }

  function card(creation) {
    const output = creation.outputs[0];
    const media = h(
      'button',
      {
        class: 'card__media',
        type: 'button',
        'aria-label': `Ouvrir ${creation.type === 'video' ? 'la vidéo' : 'l’image'} : ${creation.prompt || creation.operationLabel}`,
        disabled: !output,
        onclick: () => openCreation(creation, { onDelete: remove }),
      },
      output
        ? mediaElement(creation, output, { thumb: true })
        : h(
            'div',
            { class: 'card__placeholder' },
            creation.status === 'failed' ? creation.error || 'Échec' : creation.statusText || 'Génération en cours…',
          ),
      h(
        'span',
        { class: 'tag' },
        icon(creation.type === 'video' ? 'video' : 'image', { size: 12 }),
        creation.type === 'video' ? 'Vidéo' : 'Image',
      ),
      statusTag(creation.status),
    );
    const actions = h('div', { class: 'card__actions' });
    if (output) {
      actions.append(
        h('a', { class: 'btn btn--sm', href: downloadUrl(output), download: '', 'aria-label': 'Télécharger' }, icon('download')),
      );
    }
    if (creation.operation === 'generate') {
      actions.append(
        h('button', { class: 'btn btn--sm', type: 'button', onclick: () => regenerateFrom(creation) }, icon('refresh'), 'Régénérer'),
      );
    }
    if (creation.status === 'failed' && creation.retryable) {
      actions.append(h('button', { class: 'btn btn--sm', type: 'button', onclick: () => retry(creation) }, icon('refresh'), 'Réessayer'));
    }
    if (output) {
      actions.append(
        h(
          'button',
          {
            class: 'btn btn--sm',
            type: 'button',
            'aria-label': 'Envoyer vers l’éditeur',
            title: 'Envoyer vers l’éditeur',
            onclick: () => sendToEditor({ url: output.url, mime: output.mime, name: creation.prompt || creation.operationLabel }),
          },
          icon('layers'),
        ),
      );
    }
    if (creation.type === 'image' && output) {
      actions.append(
        h('a', { class: 'btn btn--sm', href: `/retouche?source=${creation.id}`, 'data-link': '', 'aria-label': 'Retoucher' }, icon('wand')),
      );
    }
    actions.append(
      h(
        'button',
        { class: 'btn btn--sm btn--ghost', type: 'button', 'aria-label': 'Supprimer', onclick: () => remove(creation) },
        icon('trash'),
      ),
    );

    return h(
      'article',
      { class: 'card' },
      media,
      h(
        'div',
        { class: 'card__body' },
        creation.prompt && !creation.autoPrompt
          ? h('p', { class: 'card__prompt' }, creation.prompt)
          : h('p', { class: 'card__prompt card__prompt--muted' }, creation.operationLabel || 'Sans description'),
        h(
          'div',
          { class: 'card__meta' },
          h('time', { datetime: creation.createdAt }, formatDate(creation.createdAt)),
          h('span', {}, creation.model),
          creation.outputs.length > 1 ? h('span', {}, `${creation.outputs.length} images`) : null,
        ),
      ),
      actions,
    );
  }

  async function load() {
    clearTimeout(poll);
    try {
      const { creations } = await api.creations({ type: type || undefined, sort });
      if (!alive) return;
      clear(grid);
      countEl.textContent = `${creations.length} création${creations.length > 1 ? 's' : ''}`;
      if (creations.length === 0) {
        grid.append(
          h(
            'div',
            { style: { gridColumn: '1 / -1' } },
            emptyStage({
              title: type ? 'Rien dans cette catégorie' : 'Votre galerie est vide',
              text: 'Les images et vidéos que vous créez sont enregistrées ici automatiquement.',
            }),
            h(
              'div',
              { class: 'hero__cta', style: { justifyContent: 'center' } },
              h('a', { class: 'btn btn--primary', href: '/images', 'data-link': '' }, icon('image'), 'Créer une image'),
              h('a', { class: 'btn', href: '/videos', 'data-link': '' }, icon('video'), 'Créer une vidéo'),
            ),
          ),
        );
        return;
      }
      grid.append(...creations.map(card));
      // Refresh while some jobs are still running so statuses stay accurate.
      if (creations.some((c) => c.status === 'pending' || c.status === 'running')) poll = setTimeout(load, 4000);
    } catch (error) {
      if (!alive) return;
      clear(grid).append(h('div', { style: { gridColumn: '1 / -1' } }, notice('error', h('p', {}, error.message))));
    }
  }
  load();

  const el = h(
    'div',
    { class: 'page container' },
    h(
      'header',
      { class: 'gallery-head' },
      h(
        'div',
        {},
        h('span', { class: 'eyebrow' }, icon('gallery', { size: 14 }), 'Créations IA'),
        h('h1', { class: 'section__title', style: { marginBottom: '4px' } }, 'Mes créations'),
        h('p', { class: 'section__lead' }, 'Les images et vidéos générées par SOLVEX AI, conservées sur le serveur. Vos montages sont dans « Projets ».'),
        countEl,
      ),
      h('div', { class: 'filters' }, filterGroup, sortSelect),
    ),
    grid,
  );
  return {
    el,
    title: 'Mes créations',
    cleanup: () => {
      alive = false;
      clearTimeout(poll);
    },
  };
}
