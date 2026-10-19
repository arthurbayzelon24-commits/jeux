import { h, clear } from '../lib/dom.js';
import { icon } from './icons.js';

let region;

export function toast(message, { type = 'info', duration = 5000 } = {}) {
  if (!region) {
    region = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(region);
  }
  const iconName = type === 'error' ? 'alert' : type === 'success' ? 'check' : 'info';
  const el = h('div', { class: `toast toast--${type}` }, icon(iconName), h('div', {}, message));
  region.append(el);
  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 320);
  }, duration);
}

/** Accessible confirmation dialog built on <dialog>. Resolves to true/false. */
export function confirmDialog({ title, message, confirmLabel = 'Confirmer', danger = false }) {
  return new Promise((resolve) => {
    const cancel = h('button', { class: 'btn btn--ghost', type: 'button', value: 'cancel' }, 'Annuler');
    const ok = h('button', { class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`, type: 'button' }, confirmLabel);
    const dialog = h(
      'dialog',
      { 'aria-labelledby': 'confirm-title' },
      h('div', { class: 'dialog__body' }, h('h2', { id: 'confirm-title' }, title), h('p', {}, message)),
      h('div', { class: 'dialog__actions' }, cancel, ok),
    );
    let result = false;
    cancel.addEventListener('click', () => dialog.close());
    ok.addEventListener('click', () => {
      result = true;
      dialog.close();
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(result);
    });
    document.body.append(dialog);
    dialog.showModal();
    cancel.focus();
  });
}

/** Generic modal wrapper. Returns { dialog, close }. */
export function openModal(content, { className = '', label } = {}) {
  const closeBtn = h(
    'button',
    { class: 'btn btn--icon btn--ghost lightbox__close', type: 'button', 'aria-label': 'Fermer' },
    icon('close'),
  );
  const dialog = h('dialog', { class: className, 'aria-label': label }, closeBtn, content);
  closeBtn.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    dialog.querySelectorAll('video').forEach((video) => video.pause());
    dialog.remove();
  });
  document.body.append(dialog);
  dialog.showModal();
  return { dialog, close: () => dialog.close() };
}

export function notice(type, ...content) {
  const iconName = type === 'error' ? 'alert' : type === 'info' ? 'info' : 'alert';
  return h(
    'div',
    { class: `notice ${type === 'warn' ? '' : `notice--${type}`}`, role: type === 'error' ? 'alert' : null },
    icon(iconName),
    h('div', {}, ...content),
  );
}

export function setBusy(button, busy, busyLabel) {
  button.classList.toggle('is-loading', busy);
  button.disabled = busy;
  if (busy) {
    button.setAttribute('aria-busy', 'true');
    if (busyLabel) button.setAttribute('aria-label', busyLabel);
  } else {
    button.removeAttribute('aria-busy');
    button.removeAttribute('aria-label');
  }
}

export { clear };
