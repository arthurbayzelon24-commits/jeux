import { isStatic } from './lib/env.js';

const routes = new Map();
let outlet;
let cleanup = null;
let onChange = () => {};
let renderId = 0;

// The static build runs inside a sandboxed frame whose URL it does not own:
// navigation is kept in memory; a bare #token (e.g. #studio) picks the first page.
let memoryPath = null;

/** Current app location as "/path?query". */
export function currentLocation() {
  if (isStatic()) {
    memoryPath ??= /^#[\w-]+$/.test(location.hash) ? `/${location.hash.slice(1)}` : '/';
    return memoryPath;
  }
  return location.pathname + location.search;
}

export function defineRoutes(table, { root, afterNavigate }) {
  for (const [path, page] of Object.entries(table)) routes.set(path, page);
  outlet = root;
  onChange = afterNavigate || onChange;

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-link]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const href = link.getAttribute('href');
    if (!href || /^[a-z]+:/i.test(href)) return;
    event.preventDefault();
    navigate(href.replace(/^#/, ''));
  });
  if (!isStatic()) window.addEventListener('popstate', () => render());
}

export function navigate(path, { replace = false } = {}) {
  if (path === currentLocation()) return;
  if (isStatic()) {
    memoryPath = path;
    render();
    return;
  }
  history[replace ? 'replaceState' : 'pushState']({}, '', path);
  render();
}

export async function render() {
  const id = ++renderId;
  const url = new URL(currentLocation(), 'http://solvex.local');
  const page = routes.get(url.pathname) || routes.get('*');
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  let view;
  try {
    view = await page({ params: url.searchParams });
  } catch (error) {
    console.error(error);
    view = {
      title: 'Erreur',
      el: Object.assign(document.createElement('div'), {
        className: 'page container',
        textContent: `Cette page n’a pas pu s’afficher : ${error.message}`,
      }),
    };
  }
  if (id !== renderId) {
    view.cleanup?.();
    return; // a newer navigation happened meanwhile
  }
  outlet.replaceChildren(view.el);
  cleanup = view.cleanup || null;
  document.body.classList.toggle('is-app', Boolean(view.fullscreen));
  document.title = view.title ? `${view.title} · SOLVEX AI` : 'SOLVEX AI — Studio créatif';
  window.scrollTo({ top: 0, behavior: 'instant' });
  onChange(url.pathname);
  const heading = outlet.querySelector('h1');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
}
