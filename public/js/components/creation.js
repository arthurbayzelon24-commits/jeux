import { sendToEditor } from '../studio/projectActions.js';
import { h, clear, formatDate, formatDuration, formatBytes } from '../lib/dom.js';
import { api, watchCreation } from '../lib/api.js';
import { icon } from './icons.js';
import { logoMark } from './logo.js';
import { openModal, setBusy, toast } from './feedback.js';
import { navigate } from '../router.js';

export const STATUS_LABELS = {
  pending: 'En attente',
  running: 'En cours',
  succeeded: 'Terminé',
  failed: 'Échoué',
};
const STATUS_TAG = { pending: 'tag--run', running: 'tag--run', succeeded: 'tag--ok', failed: 'tag--fail' };

export function statusTag(status) {
  return h('span', { class: `tag ${STATUS_TAG[status] || ''} card__status` }, STATUS_LABELS[status] || status);
}

export function mediaElement(creation, output, { controls = true, thumb = false } = {}) {
  if (creation.type === 'video') {
    return h('video', {
      src: output.url,
      controls: controls && !thumb,
      muted: thumb,
      playsInline: true,
      preload: thumb ? 'metadata' : 'auto',
      'aria-label': creation.prompt ? `Vidéo : ${creation.prompt.slice(0, 120)}` : 'Vidéo générée',
    });
  }
  return h('img', {
    src: output.url,
    alt: creation.prompt ? `Image générée : ${creation.prompt.slice(0, 160)}` : 'Image créée',
    loading: thumb ? 'lazy' : 'eager',
    decoding: 'async',
    width: output.width || null,
    height: output.height || null,
  });
}

export const downloadUrl = (output) => `${output.url}?download=1`;

/** Stores a prompt to prefill a studio, then opens it. */
export function regenerateFrom(creation) {
  try {
    sessionStorage.setItem(
      'solvex:prefill',
      JSON.stringify({ type: creation.type, prompt: creation.autoPrompt ? '' : creation.prompt, params: creation.params }),
    );
  } catch {
    // Without storage the studio simply opens empty.
  }
  navigate(creation.type === 'video' ? '/videos' : '/images');
}

export function takePrefill(type) {
  try {
    const raw = sessionStorage.getItem('solvex:prefill');
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.type !== type) return null;
    sessionStorage.removeItem('solvex:prefill');
    return data;
  } catch {
    return null;
  }
}

/**
 * Renders a creation's live state inside a studio stage and keeps polling the
 * server until it is final. Elapsed time is real; a percentage is only shown
 * when the provider reports one.
 */
export function trackCreation(container, creation, { onFinal, onRetry } = {}) {
  const controller = new AbortController();
  const started = new Date(creation.startedAt || creation.createdAt).getTime();
  let timer = null;
  let latest = creation;

  const statusEl = h('p', { class: 'job__status', role: 'status', 'aria-live': 'polite' });
  const metaEl = h('p', { class: 'job__meta' });
  const barFill = h('span');
  const bar = h('div', { class: 'job__bar', hidden: true, role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' }, barFill);
  const view = h(
    'div',
    { class: 'job' },
    h('div', { class: 'job__ring', 'aria-hidden': 'true' }, ringSvg(), h('div', { class: 'job__mark' }, logoMark({ title: '' }))),
    statusEl,
    bar,
    metaEl,
  );

  function tick() {
    metaEl.textContent = `Temps écoulé ${formatDuration(Date.now() - started)}${latest.type === 'video' ? ' · une vidéo prend souvent plusieurs minutes' : ''}`;
  }

  function render(item) {
    latest = item;
    if (item.status === 'pending' || item.status === 'running') {
      if (!view.isConnected) {
        clear(container).append(view);
      }
      statusEl.textContent = item.statusText || STATUS_LABELS[item.status];
      const hasProgress = typeof item.progress === 'number';
      bar.hidden = !hasProgress;
      if (hasProgress) {
        barFill.style.width = `${item.progress}%`;
        bar.setAttribute('aria-valuenow', String(item.progress));
      }
      tick();
      timer ??= setInterval(tick, 1000);
      return;
    }
    clearInterval(timer);
    timer = null;
    if (item.status === 'succeeded') renderResult(container, item);
    else renderFailure(container, item, onRetry);
    onFinal?.(item);
  }

  render(creation);
  if (creation.status === 'pending' || creation.status === 'running') {
    watchCreation(creation.id, { onUpdate: render, signal: controller.signal }).catch((error) => {
      clearInterval(timer);
      renderFailure(container, { ...latest, error: `Suivi interrompu : ${error.message}`, retryable: false }, onRetry);
    });
  }
  return () => {
    controller.abort();
    clearInterval(timer);
  };
}

function ringSvg() {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('viewBox', '0 0 100 100');
  el.innerHTML =
    '<defs><linearGradient id="ring-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#45E5F5"/><stop offset=".5" stop-color="#4263FF"/><stop offset="1" stop-color="#8B5CF6" stop-opacity="0"/></linearGradient></defs>' +
    '<circle cx="50" cy="50" r="46" fill="none" stroke="rgba(130,148,255,.15)" stroke-width="2"/>' +
    '<circle cx="50" cy="50" r="46" fill="none" stroke="url(#ring-g)" stroke-width="3" stroke-linecap="round" stroke-dasharray="190 400"/>';
  return el;
}

export function renderResult(container, creation) {
  const multi = creation.outputs.length > 1;
  const grid = h('div', { class: `results${multi ? ' results--multi' : ''}` });
  creation.outputs.forEach((output, index) => {
    const actions = h(
      'div',
      { class: 'result__actions' },
      h('a', { class: 'btn btn--sm btn--icon', href: downloadUrl(output), download: '', 'aria-label': 'Télécharger' }, icon('download')),
      h(
        'button',
        {
          class: 'btn btn--sm btn--icon',
          type: 'button',
          'aria-label': 'Afficher en grand',
          onclick: () => openCreation(creation, { index }),
        },
        icon('expand'),
      ),
      creation.type === 'image'
        ? h(
            'a',
            {
              class: 'btn btn--sm btn--icon',
              href: `/retouche?source=${creation.id}&index=${index}`,
              'data-link': '',
              'aria-label': 'Retoucher cette image',
            },
            icon('wand'),
          )
        : null,
    );
    grid.append(h('figure', { class: 'result', style: { margin: 0 } }, mediaElement(creation, output), actions));
  });
  clear(container).append(grid);
}

function renderFailure(container, creation, onRetry) {
  const retry = h('button', { class: 'btn btn--primary', type: 'button' }, icon('refresh'), 'Réessayer');
  retry.addEventListener('click', async () => {
    setBusy(retry, true);
    try {
      const { creation: next } = await api.retry(creation.id);
      onRetry?.(next);
    } catch (error) {
      toast(error.message, { type: 'error' });
      setBusy(retry, false);
    }
  });
  clear(container).append(
    h(
      'div',
      { class: 'empty', role: 'alert' },
      h('div', { class: 'empty__mark', style: { color: 'var(--danger)' } }, icon('alert', { size: 56 })),
      h('h3', {}, 'La génération a échoué'),
      h('p', {}, creation.error || 'Erreur inconnue.'),
      creation.retryable ? retry : null,
    ),
  );
}

/** Large view with all metadata and actions. */
export function openCreation(creation, { index = 0, onDelete } = {}) {
  const output = creation.outputs[index];
  const details = h(
    'dl',
    { class: 'details' },
    h('dt', {}, 'Type'),
    h('dd', {}, creation.type === 'video' ? 'Vidéo' : 'Image'),
    h('dt', {}, 'Opération'),
    h('dd', {}, creation.operationLabel || '—'),
    h('dt', {}, 'Créée le'),
    h('dd', {}, formatDate(creation.createdAt)),
    h('dt', {}, 'Modèle'),
    h('dd', {}, creation.model || '—'),
    h('dt', {}, 'Statut'),
    h('dd', {}, STATUS_LABELS[creation.status]),
    creation.params?.aspect ? [h('dt', {}, 'Format'), h('dd', {}, creation.params.aspect)] : null,
    creation.params?.duration ? [h('dt', {}, 'Durée'), h('dd', {}, `${creation.params.duration} s`)] : null,
    creation.params?.resolution ? [h('dt', {}, 'Résolution'), h('dd', {}, creation.params.resolution)] : null,
    output?.width ? [h('dt', {}, 'Dimensions'), h('dd', {}, `${output.width} × ${output.height} px`)] : null,
    output?.bytes ? [h('dt', {}, 'Poids'), h('dd', {}, formatBytes(output.bytes))] : null,
  );
  const actions = h('div', { class: 'result-bar__actions' });
  if (output)
    actions.append(h('a', { class: 'btn btn--primary btn--sm', href: downloadUrl(output), download: '' }, icon('download'), 'Télécharger'));
  if (creation.operation === 'generate') {
    actions.append(
      h(
        'button',
        { class: 'btn btn--sm', type: 'button', onclick: () => (modal.close(), regenerateFrom(creation)) },
        icon('refresh'),
        'Régénérer',
      ),
    );
  }
  if (output) {
    actions.append(
      h(
        'button',
        {
          class: 'btn btn--sm',
          type: 'button',
          onclick: () => (modal.close(), sendToEditor({ url: output.url, mime: output.mime, name: creation.prompt || creation.operationLabel })),
        },
        icon('layers'),
        'Envoyer vers l’éditeur',
      ),
    );
  }
  if (creation.type === 'image' && output) {
    actions.append(
      h(
        'a',
        { class: 'btn btn--sm', href: `/retouche?source=${creation.id}&index=${index}`, 'data-link': '', onclick: () => modal.close() },
        icon('wand'),
        'Retoucher',
      ),
    );
  }
  if (onDelete)
    actions.append(
      h(
        'button',
        { class: 'btn btn--sm btn--danger', type: 'button', onclick: () => onDelete(creation, modal) },
        icon('trash'),
        'Supprimer',
      ),
    );

  const content = h(
    'div',
    { class: 'lightbox__inner' },
    h(
      'div',
      { class: 'lightbox__media' },
      output ? mediaElement(creation, output) : h('p', { class: 'empty' }, creation.error || 'Aucun fichier.'),
    ),
    h(
      'div',
      { class: 'lightbox__side' },
      h('h2', {}, creation.operationLabel || 'Création'),
      creation.prompt
        ? h('p', { class: 'prompt-quote' }, creation.prompt)
        : h('p', { class: 'field__hint' }, 'Aucune description (traitement local).'),
      creation.autoPrompt
        ? h('p', { class: 'field__hint' }, 'Instruction générée automatiquement par SOLVEX, aucune description n’ayant été saisie.')
        : null,
      details,
      creation.error ? h('p', { class: 'field__hint field__hint--warn' }, creation.error) : null,
      actions,
    ),
  );
  const modal = openModal(content, { className: 'lightbox', label: 'Détail de la création' });
  return modal;
}
