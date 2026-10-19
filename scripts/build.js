// Build step: lists the app shell for the service worker and stamps sw.js with
// a content hash, so browsers detect a new version exactly when files change.
// Also checks that the app version matches the latest entry of /updates.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');
const SKIP = new Set(['sw.js', 'asset-manifest.json']);
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const rel = path.relative(pub, full).split(path.sep).join('/');
    if (statSync(full).isDirectory()) {
      if (rel !== 'updates') walk(full);
    } else if (!SKIP.has(rel) && !name.startsWith('.')) files.push(rel);
  }
};
walk(pub);

const hash = createHash('sha256');
for (const rel of files) hash.update(rel).update(readFileSync(path.join(pub, rel)));
const version = hash.digest('hex').slice(0, 12);

const assets = ['/', ...files.filter((f) => f !== 'index.html' && f !== 'static.html').map((f) => `/${f}`)];
writeFileSync(path.join(pub, 'asset-manifest.json'), `${JSON.stringify({ version, assets }, null, 2)}\n`);
const swPath = path.join(pub, 'sw.js');
const sw = readFileSync(swPath, 'utf8').replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`);
writeFileSync(swPath, sw);

const env = readFileSync(path.join(pub, 'js/lib/env.js'), 'utf8');
const appVersion = /APP_VERSION = '([^']+)'/.exec(env)?.[1];
const updates = JSON.parse(readFileSync(path.join(pub, 'updates/index.json'), 'utf8'));
if (appVersion !== updates.latest) {
  console.error(`Version incohérente : APP_VERSION=${appVersion} mais updates/index.json indique ${updates.latest}.`);
  process.exit(1);
}
for (const v of updates.releases) {
  const release = JSON.parse(readFileSync(path.join(pub, `updates/${v}.json`), 'utf8'));
  if (release.version !== v || !release.name || !Array.isArray(release.notes)) {
    console.error(`updates/${v}.json invalide (version, name et notes requis).`);
    process.exit(1);
  }
}
console.log(`Service worker ${version} · ${assets.length} fichiers · version ${appVersion}`);
