/* FAZNIGHT service worker: offline play once loaded. Bump VERSION when files change. */
const VERSION = 'faznight-1.0.0';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'css/style.css',
  'js/i18n.js', 'js/save.js', 'js/audio.js', 'js/art.js', 'js/characters.js', 'js/rooms.js', 'js/trophies.js',
  'js/engine.js', 'js/chapter1.js', 'js/chapter2.js', 'js/minigame.js', 'js/ui.js', 'js/main.js'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('faznight-') && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // network first so updates arrive, cache as offline fallback
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});
