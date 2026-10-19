import { h, clear, formatBytes } from '../lib/dom.js';
import { api } from '../lib/api.js';
import { icon } from './icons.js';
import { setBusy, toast } from './feedback.js';

let groupId = 0;

/** Radio-button chip group (keyboard accessible via native radios). */
export function chipGroup({ legend, name, options, value, onChange, hint }) {
  const id = `grp-${++groupId}`;
  const fieldset = h('fieldset', { class: 'chips', 'aria-labelledby': `${id}-legend` });
  const hintEl = hint ? h('p', { class: 'field__hint', id: `${id}-hint` }, hint) : null;
  const wrapper = h('div', { class: 'field' }, h('div', { class: 'field__label', id: `${id}-legend` }, legend), fieldset, hintEl);

  function render(list, selected) {
    clear(fieldset);
    for (const option of list) {
      const input = h('input', {
        type: 'radio',
        name: name || id,
        value: option.id,
        checked: option.id === selected,
        disabled: option.disabled,
        'aria-describedby': option.title ? undefined : undefined,
      });
      input.addEventListener('change', () => onChange?.(option.id));
      const label = h(
        'label',
        { class: 'chip', title: option.title || null },
        input,
        h('span', {}, option.ratio ? ratioIcon(option.ratio) : null, option.label),
      );
      fieldset.append(label);
    }
  }
  render(options, value);

  return {
    el: wrapper,
    update: render,
    setHint(text, warn = false) {
      if (!hintEl) return;
      hintEl.textContent = text;
      hintEl.classList.toggle('field__hint--warn', warn);
    },
  };
}

function ratioIcon(ratio, box = 14) {
  const [w, h_] = ratio.split(':').map(Number);
  const scale = box / Math.max(w, h_);
  return h('i', {
    class: 'ratio-icon',
    style: { width: `${Math.round(w * scale)}px`, height: `${Math.round(h_ * scale)}px` },
    'aria-hidden': 'true',
  });
}

export function selectField({ label, options, value, onChange, hint }) {
  const id = `sel-${++groupId}`;
  const select = h('select', { class: 'select', id });
  const fill = (list, selected) => {
    clear(select);
    for (const option of list) {
      select.append(h('option', { value: option.id, selected: option.id === selected, disabled: option.disabled }, option.label));
    }
  };
  fill(options, value);
  select.addEventListener('change', () => onChange?.(select.value));
  const el = h(
    'div',
    { class: 'field' },
    h('label', { class: 'field__label', for: id }, label),
    select,
    hint ? h('p', { class: 'field__hint' }, hint) : null,
  );
  return { el, select, update: fill };
}

export function stepper({ label, min, max, value, onChange }) {
  let current = value;
  const out = h('output', { 'aria-live': 'polite' }, String(current));
  const minus = h('button', { type: 'button', 'aria-label': 'Diminuer' }, '−');
  const plus = h('button', { type: 'button', 'aria-label': 'Augmenter' }, '+');
  const sync = () => {
    out.textContent = String(current);
    minus.disabled = current <= min;
    plus.disabled = current >= max;
  };
  minus.addEventListener('click', () => {
    current = Math.max(min, current - 1);
    sync();
    onChange(current);
  });
  plus.addEventListener('click', () => {
    current = Math.min(max, current + 1);
    sync();
    onChange(current);
  });
  sync();
  const el = h(
    'div',
    { class: 'field' },
    h('div', { class: 'field__label' }, label),
    h('div', { class: 'stepper', role: 'group', 'aria-label': label }, minus, out, plus),
  );
  return {
    el,
    setMax(next) {
      max = next;
      current = Math.min(current, max);
      sync();
      onChange(current);
    },
  };
}

/**
 * Prompt textarea with character counter and the « Améliorer le prompt » action.
 * The enhancement method (local rules vs. language model) is shown honestly.
 */
export function promptField({ label, placeholder, kind, maxLength, enhancement, getStyle, initial = '', optional = false }) {
  const id = `prompt-${++groupId}`;
  const textarea = h('textarea', { class: 'textarea', id, placeholder, maxLength, rows: 5, spellcheck: 'true' });
  textarea.value = initial;
  const counter = h('span', { class: 'counter' });
  const updateCounter = () => {
    counter.textContent = `${textarea.value.length} / ${maxLength}`;
  };
  textarea.addEventListener('input', updateCounter);
  updateCounter();

  const enhanceBtn = h('button', { type: 'button', class: 'btn btn--sm' }, icon('sparkles'), 'Améliorer le prompt');
  const methodNote =
    enhancement?.method === 'model'
      ? `Réécriture par le modèle ${enhancement.model}`
      : 'Enrichissement local par règles (aucun modèle de langage configuré)';
  const previous = [];
  const undoBtn = h('button', { type: 'button', class: 'btn btn--sm btn--ghost', hidden: true }, icon('undo'), 'Annuler');

  enhanceBtn.addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (!text) {
      toast('Écrivez d’abord une idée, même courte, puis améliorez-la.', { type: 'info' });
      textarea.focus();
      return;
    }
    setBusy(enhanceBtn, true, 'Amélioration en cours');
    try {
      const result = await api.enhancePrompt({ prompt: text, kind, style: getStyle?.() });
      previous.push(textarea.value);
      textarea.value = result.prompt.slice(0, maxLength);
      updateCounter();
      undoBtn.hidden = false;
      toast(result.method === 'model' ? 'Description réécrite par le modèle de langage.' : 'Description enrichie localement (sans IA).', {
        type: 'success',
        duration: 3500,
      });
    } catch (error) {
      toast(error.message, { type: 'error' });
    } finally {
      setBusy(enhanceBtn, false);
    }
  });
  undoBtn.addEventListener('click', () => {
    if (previous.length === 0) return;
    textarea.value = previous.pop();
    updateCounter();
    undoBtn.hidden = previous.length === 0;
  });

  const el = h(
    'div',
    { class: 'field prompt-box' },
    h('label', { class: 'field__label', for: id }, label, optional ? h('span', { class: 'tag' }, 'facultatif') : null),
    textarea,
    h('div', { class: 'prompt-box__meta' }, h('div', { style: { display: 'flex', gap: '6px' } }, enhanceBtn, undoBtn), counter),
    h('p', { class: 'field__hint' }, methodNote),
  );
  return { el, textarea, value: () => textarea.value.trim(), set: (v) => ((textarea.value = v), updateCounter()) };
}

/**
 * File picker + drag-and-drop that uploads each image to the server right away
 * (type is re-checked server-side from the file's bytes) and keeps its id.
 */
export function imageDropzone({
  label,
  hint,
  max = 1,
  accept = ['image/png', 'image/jpeg', 'image/webp'],
  maxBytes,
  onChange,
  optional = true,
}) {
  const items = []; // { id, url, file, pending }
  const id = `drop-${++groupId}`;
  const input = h('input', { type: 'file', id, accept: accept.join(','), multiple: max > 1, 'aria-describedby': `${id}-hint` });
  const zone = h(
    'label',
    { class: 'dropzone', for: id },
    icon('upload'),
    h('span', {}, h('strong', {}, 'Importer une image'), ' ou glisser-déposer'),
    h(
      'span',
      { class: 'field__hint', id: `${id}-hint` },
      hint || `${accept.map((t) => t.split('/')[1].toUpperCase()).join(', ')} · ${formatBytes(maxBytes)} max`,
    ),
    input,
  );
  const thumbs = h('div', { class: 'thumbs' });
  const el = h(
    'div',
    { class: 'field' },
    h('div', { class: 'field__label' }, label, optional ? h('span', { class: 'tag' }, 'facultatif') : null),
    zone,
    thumbs,
  );

  const emit = () => onChange?.(items.filter((item) => item.id).map((item) => item.id));

  function renderThumbs() {
    clear(thumbs);
    for (const item of items) {
      const remove = h('button', { type: 'button', class: 'thumb__remove', 'aria-label': `Retirer ${item.file.name}` }, icon('close'));
      remove.addEventListener('click', () => {
        items.splice(items.indexOf(item), 1);
        URL.revokeObjectURL(item.url);
        renderThumbs();
        emit();
      });
      thumbs.append(
        h('div', { class: `thumb${item.pending ? ' is-uploading' : ''}` }, h('img', { src: item.url, alt: item.file.name }), remove),
      );
    }
    zone.hidden = items.length >= max;
  }

  async function addFiles(files) {
    for (const file of files) {
      if (items.length >= max) {
        toast(`${max} image${max > 1 ? 's' : ''} maximum.`, { type: 'info' });
        break;
      }
      if (!accept.includes(file.type)) {
        toast(`« ${file.name} » : format non accepté (${accept.map((t) => t.split('/')[1].toUpperCase()).join(', ')}).`, { type: 'error' });
        continue;
      }
      if (maxBytes && file.size > maxBytes) {
        toast(`« ${file.name} » dépasse ${formatBytes(maxBytes)}.`, { type: 'error' });
        continue;
      }
      const item = { id: null, url: URL.createObjectURL(file), file, pending: true };
      items.push(item);
      renderThumbs();
      try {
        const result = await api.upload(file);
        item.id = result.id;
        item.meta = result;
        item.pending = false;
      } catch (error) {
        items.splice(items.indexOf(item), 1);
        URL.revokeObjectURL(item.url);
        toast(`« ${file.name} » : ${error.message}`, { type: 'error' });
      }
      renderThumbs();
      emit();
    }
  }

  input.addEventListener('change', () => {
    addFiles([...input.files]);
    input.value = '';
  });
  for (const type of ['dragenter', 'dragover']) {
    zone.addEventListener(type, (event) => {
      event.preventDefault();
      zone.classList.add('is-over');
    });
  }
  for (const type of ['dragleave', 'drop']) {
    zone.addEventListener(type, () => zone.classList.remove('is-over'));
  }
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    addFiles([...(event.dataTransfer?.files || [])]);
  });

  return {
    el,
    ids: () => items.filter((item) => item.id).map((item) => item.id),
    first: () => items.find((item) => item.id) || null,
    busy: () => items.some((item) => item.pending),
    reset() {
      items.splice(0).forEach((item) => URL.revokeObjectURL(item.url));
      renderThumbs();
      emit();
    },
    setMax(next) {
      max = next;
      input.multiple = max > 1;
      renderThumbs();
    },
  };
}

/**
 * Visual option cards backed by native radios (mouse, keyboard and touch).
 * options: [{ id, label, sub, ratio, disabled, reason }]. A disabled card
 * shows why it is unavailable instead of pretending to work.
 */
export function optionCards({ legend, name, options, value, onChange, hint, columns = 'auto' }) {
  const id = `cards-${++groupId}`;
  const fieldset = h('fieldset', { class: `opt-cards opt-cards--${columns}`, 'aria-labelledby': `${id}-legend` });
  const hintEl = h('p', { class: 'field__hint', id: `${id}-hint`, hidden: !hint }, hint || '');
  const wrapper = h('div', { class: 'field' }, h('div', { class: 'field__label', id: `${id}-legend` }, legend), fieldset, hintEl);
  let current = value;
  function render(list, selected = current) {
    current = selected;
    clear(fieldset);
    for (const option of list) {
      const input = h('input', { type: 'radio', name: name || id, value: option.id, checked: option.id === selected, disabled: Boolean(option.disabled) });
      input.addEventListener('change', () => {
        current = option.id;
        onChange?.(option.id);
      });
      fieldset.append(
        h(
          'label',
          { class: `opt-card${option.disabled ? ' is-disabled' : ''}`, title: option.reason || option.label },
          input,
          h(
            'span',
            { class: 'opt-card__box' },
            option.ratio ? ratioIcon(option.ratio, 22) : null,
            h('strong', {}, option.label),
            option.sub ? h('small', {}, option.sub) : null,
            option.disabled && option.reason ? h('small', { class: 'opt-card__why' }, option.reason) : null,
          ),
        ),
      );
    }
  }
  render(options, value);
  return {
    el: wrapper,
    update: render,
    setHint(text, warn = false) {
      hintEl.hidden = !text;
      hintEl.textContent = text || '';
      hintEl.classList.toggle('field__hint--warn', warn);
    },
  };
}
