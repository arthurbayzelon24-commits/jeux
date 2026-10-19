/* SOLVEX AI service worker — generated version line, do not edit by hand. */
const VERSION = '1f85afba3449';
const CACHE = `solvex-shell-${VERSION}`;

// The asset list is produced by `npm run build` (scripts/build.js).
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const manifest = await fetch('/asset-manifest.json', { cache: 'reload' }).then((r) => (r.ok ? r.json() : { assets: ['/'] }));
      const cache = await caches.open(CACHE);
      await cache.addAll(manifest.assets.map((url) => new Request(url, { cache: 'reload' })));
    })(),
  );
  // No skipWaiting here: the new version waits until the user accepts it.
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith('solvex-shell-') && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Never cache the API, user media or the update feed.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/updates/')) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (event.request.mode === 'navigate') {
        // App shell: the cached index works offline and stays on the accepted version.
        return (await cache.match('/')) || fetch(event.request);
      }
      const hit = await cache.match(event.request, { ignoreSearch: true });
      return hit || fetch(event.request);
    })(),
  );
});
