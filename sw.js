// Magic Cam service worker: works offline and keeps the installed app up to
// date. Every launch fetches the newest files first (cache only as fallback),
// and a new version of this file takes over immediately.
const VERSION = 'magic-cam-v101';
const LIB = 'magic-cam-lib';
const POWERS = [
  'free',
  'runes',
  'chidori',
  'genkidama',
  'getsuga',
  'hollowpurple',
  'sharingan',
  'supersaiyan',
  'waterbreath',
  'firefist',
  'haki',
  'domain',
  'kamehameha',
  'hud',
  'firebeam',
  'saber',
  'portal',
  'circle',
  'plasma',
  'lightning',
  'thunder',
  'fireball',
  'rasengan',
  'blackhole',
  'galaxy',
  'heart',
  'sakura',
  'butterflies',
  'koi',
  'fireworks',
  'ice',
  'water',
  'shadow',
  'aura',
  'wings',
  'teleport',
  'telekinesis',
  'floating',
  'dragon',
  'tornado',
  'meteor',
  'lava',
  'sun',
  'sonic',
  'shield',
  'lasereyes',
  'web',
  'neon',
  'matrix',
  'halo',
  'planet',
  'crystalball',
  'aurora',
  'stars',
  'comet',
  'rainbow',
  'bubbles',
  'confetti',
  'coins',
  'snow',
  'fireflies',
  'wisps',
];
const SHELL = [
  './',
  'index.html',
  'css/style.css',
  'manifest.webmanifest',
  'assets/header.jpg',
  'assets/icon4-64.png',
  'assets/icon4-180.png',
  'assets/icon4-192.png',
  'assets/icon4-512.png',
  ...POWERS.map((id) => `assets/powers/${id}.jpg`),
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== LIB).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const own = url.origin === location.origin;
  // Detection library and models: cache first (they never change for a version).
  const lib = /cdn\.jsdelivr\.net|storage\.googleapis\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host);
  if (lib) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            if (res.ok || res.type === 'opaque') {
              const copy = res.clone();
              caches.open(LIB).then((c) => c.put(e.request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }
  if (!own) return;
  // Our own files: always the newest from the network, cache when offline.
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('index.html'))),
  );
});
