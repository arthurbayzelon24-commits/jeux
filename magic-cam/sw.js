// Offline cache for the app shell. The detection models are cached by the
// browser's HTTP cache after the first visit.
const CACHE = 'magic-cam-v1';
const SHELL = [
  './',
  'index.html',
  'css/style.css',
  'manifest.webmanifest',
  'assets/icon.svg',
  'js/main.js',
  'js/engine.js',
  'js/hands.js',
  'js/tracker.js',
  'js/audio.js',
  'js/recorder.js',
  'js/gallery.js',
  'js/preview.js',
  'js/effects.js',
  'js/fx/util.js',
  'js/fx/lightning.js',
  'js/fx/fireball.js',
  'js/fx/aura.js',
  'js/fx/telekinesis.js',
  'js/fx/teleport.js',
  'js/fx/floating.js',
  'js/fx/magiccircle.js',
  'js/fx/plasma.js',
  'js/fx/galaxy.js',
  'js/fx/sakura.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network first for our own files (always fresh when online), cache as fallback.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request)),
  );
});
