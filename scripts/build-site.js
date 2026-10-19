// Builds the public website (Netlify or any static host): the full studio runs
// in the browser with real addresses, the installable app and normal downloads.
// There is no Node server behind it, so AI generation is shown as unavailable.
// Output: dist-site/ (or argv[2]). The site address comes from SITE_URL, or from
// URL, which Netlify sets during its builds; it fills the sitemap and the share tags.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'dist-site'));
const siteUrl = (process.env.SITE_URL || process.env.URL || '').replace(/\/$/, '');

execFileSync(process.execPath, [path.join(root, 'scripts/build.js')], { stdio: 'inherit' });
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(path.join(root, 'public'), out, { recursive: true, filter: (src) => !src.endsWith('static.html') });

const title = 'SOLVEX AI — Studio créatif : montage vidéo, retouche photo et IA';
const description =
  'SOLVEX AI, studio créatif gratuit en français dans le navigateur : montage vidéo multipiste, éditeur photo à calques, sous-titres, effets, transitions et export, sans installation.';
const abs = (p) => (siteUrl ? `${siteUrl}${p}` : p);
let html = readFileSync(path.join(root, 'public/index.html'), 'utf8');
html = html
  .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
  .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/>/, `<meta name="description" content="${description}" />`)
  .replace(
    '<link rel="manifest"',
    [
      siteUrl ? `<link rel="canonical" href="${siteUrl}/" />` : '',
      '<meta name="robots" content="index, follow" />',
      '<meta property="og:type" content="website" />',
      '<meta property="og:site_name" content="SOLVEX AI" />',
      `<meta property="og:title" content="${title}" />`,
      `<meta property="og:description" content="${description}" />`,
      siteUrl ? `<meta property="og:url" content="${siteUrl}/" />` : '',
      `<meta property="og:image" content="${abs('/assets/icons/icon-512.png')}" />`,
      '<meta name="twitter:card" content="summary" />',
      '<link rel="manifest"',
    ]
      .filter(Boolean)
      .join('\n    '),
  )
  .replace('<script type="module" src="/js/app.js"></script>', '<script src="/site-config.js"></script>\n    <script type="module" src="/js/app.js"></script>');
if (!html.includes('site-config.js')) throw new Error('index.html : balise de script introuvable.');
writeFileSync(path.join(out, 'index.html'), html);
// A file rather than an inline script, so the Content-Security-Policy can stay strict.
writeFileSync(path.join(out, 'site-config.js'), 'window.SOLVEX_STATIC = true;\nwindow.SOLVEX_SITE = true;\n');
// The offline cache must hold it too, or the cached page would start in server mode.
const assetManifest = JSON.parse(readFileSync(path.join(out, 'asset-manifest.json'), 'utf8'));
assetManifest.assets.push('/site-config.js');
writeFileSync(path.join(out, 'asset-manifest.json'), `${JSON.stringify(assetManifest, null, 2)}\n`);

const pages = ['/', '/projets', '/images', '/videos', '/retouche', '/parametres'];
writeFileSync(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\n${siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml\n` : ''}`);
if (siteUrl) {
  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(
    path.join(out, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
      .map((p) => `  <url><loc>${siteUrl}${p}</loc><lastmod>${today}</lastmod></url>`)
      .join('\n')}\n</urlset>\n`,
  );
}
console.log(`Site public écrit dans ${out}${siteUrl ? ` pour ${siteUrl}` : ' (sans adresse : sitemap non généré)'}`);
