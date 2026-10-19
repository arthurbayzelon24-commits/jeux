const routes = new Map();
let outlet;
let cleanup = null;
let onChange = () => {};

export function defineRoutes(table, { root, afterNavigate }) {
  for (const [path, page] of Object.entries(table)) routes.set(path, page);
  outlet = root;
  onChange = afterNavigate || onChange;

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-link]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href, location.origin);
    if (url.origin !== location.origin) return;
    event.preventDefault();
    navigate(url.pathname + url.search);
  });
  window.addEventListener('popstate', () => render());
}

export function navigate(path, { replace = false } = {}) {
  if (path === location.pathname + location.search) return;
  history[replace ? 'replaceState' : 'pushState']({}, '', path);
  render();
}

export async function render() {
  const page = routes.get(location.pathname) || routes.get('*');
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  outlet.replaceChildren();
  const view = await page({ params: new URLSearchParams(location.search) });
  outlet.replaceChildren(view.el);
  cleanup = view.cleanup || null;
  document.title = view.title ? `${view.title} · SOLVEX AI` : 'SOLVEX AI — Studio créatif';
  window.scrollTo({ top: 0, behavior: 'instant' });
  onChange(location.pathname);
  // Move focus to the new content for keyboard and screen-reader users.
  const heading = outlet.querySelector('h1');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
}
