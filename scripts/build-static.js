// Builds the public static version (no Node server): the studio, photo and
// video editors, settings and updates run fully in the browser; AI generation
// is shown as unavailable. Output: dist-static/ (or the folder given as argv[2]).
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'dist-static'));
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const dir of ['css', 'js', 'assets', 'updates']) cpSync(path.join(root, 'public', dir), path.join(out, dir), { recursive: true });

const index = readFileSync(path.join(root, 'public/index.html'), 'utf8');
const description = /name="description"\s+content="([^"]+)"/.exec(index)?.[1] || 'SOLVEX AI, studio créatif';
// Page body only: the hosting platform wraps it in its own document skeleton.
const page = `<title>SOLVEX AI</title>
<meta name="description" content="${description}">
<meta name="theme-color" content="#080B16">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="css/styles.css">
<link rel="stylesheet" href="css/studio.css">
<script>window.SOLVEX_STATIC = true;</script>
<script type="module" src="js/app.js"></script>
<a class="skip-link" href="#contenu">Aller au contenu</a>
<div id="app"><noscript><p style="padding:24px">SOLVEX AI nécessite JavaScript.</p></noscript></div>
`;
writeFileSync(path.join(out, 'index.html'), page);
console.log(`Version statique écrite dans ${out}`);
