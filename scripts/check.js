// Syntax-checks every JavaScript file (server, client, tests). No bundling is
// needed: the client is served as native ES modules.
import { readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dirs = ['server', 'public/js', 'tests', 'scripts', 'magic-cam'];
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (name.endsWith('.js')) files.push(full);
  }
};
dirs.forEach((dir) => walk(path.join(root, dir)));

let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed += 1;
    process.stderr.write(result.stderr);
  }
}
console.log(`${files.length - failed}/${files.length} fichiers JavaScript valides.`);
process.exit(failed ? 1 : 0);
