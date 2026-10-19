import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeProviders, makePng, startTestServer, waitFor } from './helpers.js';

async function json(base, path, { method = 'GET', body, headers = {} } = {}) {
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const response = await fetch(base + path, init);
  return { status: response.status, data: await response.json().catch(() => null), headers: response.headers };
}

async function upload(base, buffer, type = 'image/png') {
  const response = await fetch(`${base}/api/uploads`, { method: 'POST', headers: { 'Content-Type': type }, body: buffer });
  return { status: response.status, data: await response.json() };
}

const finished = (base, id) =>
  waitFor(async () => {
    const { data } = await json(base, `/api/creations/${id}`);
    return ['succeeded', 'failed'].includes(data.creation.status) && data.creation;
  });

test('capacités : les fournisseurs non configurés sont signalés avec la variable manquante', async (t) => {
  const srv = await startTestServer({ overrides: { openai: { apiKey: '' }, google: { apiKey: '' }, pollinations: { enabled: false } } });
  t.after(() => srv.close());
  const { status, data } = await json(srv.base, '/api/capabilities');
  assert.equal(status, 200);
  const image = data.providers.find((p) => p.kind === 'image');
  assert.equal(image.configured, false);
  assert.deepEqual(image.missing, ['OPENAI_API_KEY']);
  assert.equal(data.promptEnhancement.method, 'local');
  const gen = await json(srv.base, '/api/images/generate', { method: 'POST', body: { prompt: 'x', aspect: '1:1' } });
  assert.equal(gen.status, 503);
  assert.equal(gen.data.error.code, 'provider_not_configured');
  // Static files carry security headers and never expose secrets.
  const page = await fetch(srv.base + '/images');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
});

test('génération d’image : tâche réelle, fichiers servis, suppression', async (t) => {
  const { providers, calls } = fakeProviders();
  const srv = await startTestServer({ providers });
  t.after(() => srv.close());

  const ref = await upload(srv.base, makePng(32, 32));
  assert.equal(ref.status, 201);
  assert.equal(ref.data.width, 32);

  const { status, data } = await json(srv.base, '/api/images/generate', {
    method: 'POST',
    body: { prompt: 'un chat', style: 'cinematique', aspect: '16:9', count: 2, referenceUploadIds: [ref.data.id] },
  });
  assert.equal(status, 202);
  assert.ok(['pending', 'running'].includes(data.creation.status));
  assert.equal(data.creation.providerOperation, undefined, 'les détails internes ne sont pas exposés');

  const creation = await finished(srv.base, data.creation.id);
  assert.equal(creation.status, 'succeeded');
  assert.equal(creation.outputs.length, 2);
  assert.match(calls.generate[0].prompt, /cinematic/, 'le style est appliqué au prompt envoyé');
  assert.equal(calls.generate[0].references.length, 1);

  const media = await fetch(srv.base + creation.outputs[0].url);
  assert.equal(media.status, 200);
  assert.equal(media.headers.get('content-type'), 'image/png');
  const partial = await fetch(srv.base + creation.outputs[0].url, { headers: { Range: 'bytes=0-7' } });
  assert.equal(partial.status, 206);
  assert.equal((await partial.arrayBuffer()).byteLength, 8);

  // The reference upload is removed once the job no longer needs it.
  const reuse = await json(srv.base, '/api/images/generate', {
    method: 'POST',
    body: { prompt: 'x', aspect: '1:1', referenceUploadIds: [ref.data.id] },
  });
  assert.equal(reuse.status, 400);
  assert.equal(reuse.data.error.code, 'upload_expired');

  const list = await json(srv.base, '/api/creations?type=image');
  assert.equal(list.data.creations.length, 1);
  assert.equal((await json(srv.base, '/api/creations?type=video')).data.creations.length, 0);

  assert.equal((await json(srv.base, `/api/creations/${creation.id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await fetch(srv.base + creation.outputs[0].url)).status, 404);
  assert.equal((await json(srv.base, `/api/creations/${creation.id}`)).status, 404);
});

test('image seule : une instruction de variation explicite est utilisée', async (t) => {
  const { providers, calls } = fakeProviders();
  const srv = await startTestServer({ providers });
  t.after(() => srv.close());
  const ref = await upload(srv.base, makePng(32, 32));
  const { data } = await json(srv.base, '/api/images/generate', {
    method: 'POST',
    body: { aspect: '1:1', referenceUploadIds: [ref.data.id] },
  });
  const creation = await finished(srv.base, data.creation.id);
  assert.equal(creation.autoPrompt, true);
  assert.match(calls.generate[0].prompt, /variation/);
});

test('validation : options non prises en charge, prompt manquant, fichiers invalides', async (t) => {
  const srv = await startTestServer({ providers: fakeProviders().providers });
  t.after(() => srv.close());
  const cases = [
    [{ prompt: 'x', aspect: '4:3' }, /Format/],
    [{ prompt: '', aspect: '1:1' }, /Décrivez/],
    [{ prompt: 'x', aspect: '1:1', count: 9 }, /nombre/],
    [{ prompt: 'x', aspect: '1:1', style: 'inconnu' }, /Style/],
    [{ prompt: 'x'.repeat(5000), aspect: '1:1' }, /4000/],
    [{ prompt: 'x', aspect: '1:1', referenceUploadIds: ['../../etc/passwd'] }, /invalides/],
  ];
  for (const [body, message] of cases) {
    const { status, data } = await json(srv.base, '/api/images/generate', { method: 'POST', body });
    assert.equal(status, 400, JSON.stringify(body).slice(0, 60));
    assert.match(data.error.message, message);
  }
  const svg = await upload(srv.base, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'image/png');
  assert.equal(svg.status, 415, 'le type déclaré ne suffit pas : les octets sont vérifiés');
  const big = await fetch(`${srv.base}/api/uploads`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: Buffer.alloc(srv.config.maxUploadBytes + 10),
  });
  assert.equal(big.status, 413);
  const notJson = await fetch(`${srv.base}/api/images/generate`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' });
  assert.equal(notJson.status, 415);
  const video = await json(srv.base, '/api/videos/generate', {
    method: 'POST',
    body: { prompt: 'x', aspect: '16:9', duration: 30, resolution: '720p' },
  });
  assert.equal(video.status, 400);
  assert.match(video.data.error.message, /Durée/);
});

test('vidéo : sondage du fournisseur jusqu’au fichier final, et échec réessayable', async (t) => {
  const ok = fakeProviders({ videoPolls: 3 });
  const srv = await startTestServer({ providers: ok.providers });
  t.after(() => srv.close());
  const start = await upload(srv.base, makePng(32, 32));
  const { status, data } = await json(srv.base, '/api/videos/generate', {
    method: 'POST',
    body: { prompt: 'une forêt', aspect: '16:9', duration: 8, resolution: '720p', startUploadId: start.data.id },
  });
  assert.equal(status, 202);
  const creation = await finished(srv.base, data.creation.id);
  assert.equal(creation.status, 'succeeded');
  assert.equal(creation.progress, null, 'aucun pourcentage inventé');
  assert.equal(ok.calls.poll, 3);
  assert.equal(ok.calls.start[0].startImage.mime, 'image/png');
  const media = await fetch(srv.base + creation.outputs[0].url + '?download=1');
  assert.equal(media.headers.get('content-type'), 'video/mp4');
  assert.match(media.headers.get('content-disposition'), /attachment/);

  const failing = fakeProviders({ videoPolls: 1, failVideo: true });
  const srv2 = await startTestServer({ providers: failing.providers });
  t.after(() => srv2.close());
  const created = await json(srv2.base, '/api/videos/generate', {
    method: 'POST',
    body: { prompt: 'x', aspect: '16:9', duration: 4, resolution: '720p' },
  });
  const failed = await finished(srv2.base, created.data.creation.id);
  assert.equal(failed.status, 'failed');
  assert.match(failed.error, /Refus du fournisseur/);
  const retry = await json(srv2.base, `/api/creations/${failed.id}/retry`, { method: 'POST' });
  assert.equal(retry.status, 202);
  assert.equal(retry.data.creation.status, 'pending');
});

test('retouche : masque, source de galerie et enregistrement local', async (t) => {
  const { providers, calls } = fakeProviders();
  const srv = await startTestServer({ providers });
  t.after(() => srv.close());
  const first = await json(srv.base, '/api/images/generate', { method: 'POST', body: { prompt: 'base', aspect: '1:1' } });
  const base = await finished(srv.base, first.data.creation.id);

  const mask = await upload(srv.base, makePng(64, 64, [0, 0, 0, 0]));
  const edit = await json(srv.base, '/api/images/edit', {
    method: 'POST',
    body: { operation: 'background', prompt: 'une plage', source: { creationId: base.id, index: 0 }, maskUploadId: mask.data.id },
  });
  assert.equal(edit.status, 202);
  const edited = await finished(srv.base, edit.data.creation.id);
  assert.equal(edited.status, 'succeeded');
  assert.equal(edited.parentId, base.id);
  assert.match(calls.edit[0].prompt, /arrière-plan par : une plage/);
  assert.equal(calls.edit[0].images.length, 1);
  assert.ok(calls.edit[0].mask);

  const missingPrompt = await json(srv.base, '/api/images/edit', {
    method: 'POST',
    body: { operation: 'edit', source: { creationId: base.id } },
  });
  assert.equal(missingPrompt.status, 400);
  const unknown = await json(srv.base, '/api/images/edit', {
    method: 'POST',
    body: { operation: 'hack', prompt: 'x', source: { creationId: base.id } },
  });
  assert.equal(unknown.status, 400);

  const processed = await upload(srv.base, makePng(128, 128));
  const local = await json(srv.base, '/api/creations/local', {
    method: 'POST',
    body: { uploadId: processed.data.id, operationLabel: 'Retouche locale', parentId: base.id },
  });
  assert.equal(local.status, 201);
  assert.equal(local.data.creation.status, 'succeeded');
  assert.match(local.data.creation.model, /sans IA/);
  assert.equal(local.data.creation.outputs[0].width, 128);
});

test('sécurité : code d’accès, origine, traversée de chemin, limitation de débit', async (t) => {
  const srv = await startTestServer({
    providers: fakeProviders().providers,
    overrides: {
      accessCode: 'ouvre-toi',
      sessionSecret: 'test',
      rateLimit: { generatePerMinute: 2, uploadPerMinute: 30, enhancePerMinute: 20 },
    },
  });
  t.after(() => srv.close());

  assert.equal((await json(srv.base, '/api/capabilities')).status, 401);
  assert.deepEqual((await json(srv.base, '/api/session')).data, { authRequired: true, authenticated: false });
  assert.equal((await json(srv.base, '/api/session', { method: 'POST', body: { code: 'faux' } })).status, 401);
  const login = await json(srv.base, '/api/session', { method: 'POST', body: { code: 'ouvre-toi' } });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.match(login.headers.get('set-cookie'), /HttpOnly/);
  const headers = { cookie };
  assert.equal((await json(srv.base, '/api/capabilities', { headers })).status, 200);

  const crossSite = await json(srv.base, '/api/images/generate', {
    method: 'POST',
    body: { prompt: 'x', aspect: '1:1' },
    headers: { ...headers, Origin: 'https://evil.example' },
  });
  assert.equal(crossSite.status, 403);

  for (let i = 0; i < 2; i += 1) {
    assert.equal(
      (await json(srv.base, '/api/images/generate', { method: 'POST', body: { prompt: `x${i}`, aspect: '1:1' }, headers })).status,
      202,
    );
  }
  const limited = await json(srv.base, '/api/images/generate', { method: 'POST', body: { prompt: 'x', aspect: '1:1' }, headers });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);

  assert.equal((await fetch(`${srv.base}/api/media/..%2F..%2Fcreations.json`, { headers })).status, 404);
  assert.equal((await fetch(`${srv.base}/api/media/creations.json`, { headers })).status, 404);
  const traversal = await fetch(`${srv.base}/..%2F..%2Fserver%2Fconfig.js`);
  assert.ok([403, 404].includes(traversal.status));
  assert.equal((await json(srv.base, '/api/inconnu', { headers })).status, 404);
});

test('redémarrage : les images interrompues échouent proprement, les vidéos reprennent', async (t) => {
  const slow = fakeProviders({ imageDelay: 10_000, videoPolls: 1000 });
  const srv = await startTestServer({ providers: slow.providers });
  const img = await json(srv.base, '/api/images/generate', { method: 'POST', body: { prompt: 'lent', aspect: '1:1' } });
  const vid = await json(srv.base, '/api/videos/generate', {
    method: 'POST',
    body: { prompt: 'lent', aspect: '16:9', duration: 4, resolution: '720p' },
  });
  await waitFor(() => srv.app.store.get(vid.data.creation.id).providerOperation);
  srv.app.jobs.stop();

  // Simulate a restart on the same data directory.
  const { JobManager } = await import('../server/lib/jobs.js');
  const fast = fakeProviders({ videoPolls: 1 });
  const { createRegistry } = await import('../server/providers/registry.js');
  const jobs = new JobManager({
    store: srv.app.store,
    registry: createRegistry(srv.config, { providers: fast.providers }),
    config: srv.config,
  });
  await jobs.resume();
  t.after(async () => {
    jobs.stop();
    await srv.close();
  });
  assert.equal(srv.app.store.get(img.data.creation.id).status, 'failed');
  assert.equal(srv.app.store.get(img.data.creation.id).retryable, true);
  await waitFor(() => ['succeeded', 'failed'].includes(srv.app.store.get(vid.data.creation.id).status));
  assert.equal(srv.app.store.get(vid.data.creation.id).status, 'succeeded', srv.app.store.get(vid.data.creation.id).error);
  assert.equal(fast.calls.start.length, 0, 'la tâche vidéo existante est reprise, pas relancée');
});

test('vidéo : style et mouvement de caméra écrits dans la description, options refusées clairement', async (t) => {
  const fake = fakeProviders({ videoPolls: 1 });
  const srv = await startTestServer({ providers: fake.providers });
  t.after(() => srv.close());
  const caps = await json(srv.base, '/api/capabilities');
  assert.ok(caps.data.cameraMoves.some((m) => m.id === 'drone'));

  const ok = await json(srv.base, '/api/videos/generate', {
    method: 'POST',
    body: { prompt: 'une forêt', aspect: '16:9', duration: 8, resolution: '720p', style: 'cinematique', camera: 'drone' },
  });
  assert.equal(ok.status, 202);
  await finished(srv.base, ok.data.creation.id);
  const sent = fake.calls.start[0].prompt;
  assert.match(sent, /^une forêt/);
  assert.match(sent, /Style: cinematic/);
  assert.match(sent, /Camera: aerial drone shot/);
  const stored = await json(srv.base, `/api/creations/${ok.data.creation.id}`);
  assert.equal(stored.data.creation.prompt, 'une forêt', 'la description de l’utilisateur reste intacte');

  const badCamera = await json(srv.base, '/api/videos/generate', {
    method: 'POST',
    body: { prompt: 'x', aspect: '16:9', duration: 8, resolution: '720p', camera: 'téléportation' },
  });
  assert.equal(badCamera.status, 400);

  // The fake video model does not declare negative prompts: refused, never silently dropped.
  const negative = await json(srv.base, '/api/videos/generate', {
    method: 'POST',
    body: { prompt: 'x', aspect: '16:9', duration: 8, resolution: '720p', negativePrompt: 'flou' },
  });
  assert.equal(negative.status, 400);
  assert.equal(negative.data.error.code, 'unsupported_option');
  const negImage = await json(srv.base, '/api/images/generate', { method: 'POST', body: { prompt: 'x', aspect: '1:1', negativePrompt: 'flou' } });
  assert.equal(negImage.status, 400);
});

test('génération : description vide refusée avec un message clair', async (t) => {
  const srv = await startTestServer({ providers: fakeProviders().providers });
  t.after(() => srv.close());
  const image = await json(srv.base, '/api/images/generate', { method: 'POST', body: { prompt: '   ', aspect: '1:1' } });
  assert.equal(image.status, 400);
  assert.ok(image.data.error.message.length > 10);
  const video = await json(srv.base, '/api/videos/generate', { method: 'POST', body: { prompt: '', aspect: '16:9', duration: 8 } });
  assert.equal(video.status, 400);
  assert.match(video.data.error.message, /scène/);
});

test('PWA : manifeste installable, icônes PNG et service worker sans cache d’API', async (t) => {
  const srv = await startTestServer({ providers: fakeProviders().providers });
  t.after(() => srv.close());
  const res = await fetch(`${srv.base}/manifest.webmanifest`);
  assert.equal(res.headers.get('content-type').split(';')[0], 'application/manifest+json');
  const manifest = await res.json();
  for (const key of ['id', 'name', 'short_name', 'start_url', 'scope', 'display', 'background_color', 'theme_color']) assert.ok(manifest[key], key);
  assert.equal(manifest.display, 'standalone');
  for (const size of [192, 512]) {
    for (const purpose of ['any', 'maskable']) {
      const icon = manifest.icons.find((i) => i.sizes === `${size}x${size}` && i.purpose === purpose);
      assert.ok(icon, `${size} ${purpose}`);
      const png = Buffer.from(await (await fetch(srv.base + icon.src)).arrayBuffer());
      assert.equal(png.readUInt32BE(16), size, 'largeur réelle');
      assert.equal(png.readUInt32BE(20), size, 'hauteur réelle');
    }
  }
  const sw = await (await fetch(`${srv.base}/sw.js`)).text();
  assert.match(sw, /startsWith\('\/api\/'\)/);
  assert.doesNotMatch(sw, /skipWaiting\(\);\s*\}\)\(\)/);
  const html = await (await fetch(`${srv.base}/`)).text();
  assert.match(html, /rel="manifest"/);
  assert.match(html, /apple-touch-icon/);
  // No API key or secret may ever reach the browser.
  for (const file of ['/js/app.js', '/js/lib/api.js', '/js/lib/state.js', '/sw.js', '/manifest.webmanifest']) {
    const text = await (await fetch(srv.base + file)).text();
    assert.doesNotMatch(text, /sk-[A-Za-z0-9]{10,}|AIza[0-9A-Za-z_-]{20,}|OPENAI_API_KEY=|GEMINI_API_KEY=/);
  }
});

test('audio en ligne : Jamendo et Freesound passent par le serveur, avec licence, sans URL venant du navigateur', async (t) => {
  const { createServer } = await import('node:http');
  const seen = [];
  const mp3 = Buffer.from([0xff, 0xfb, 0x90, 0x00, ...Array(64).fill(0)]);
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    seen.push(url.pathname + url.search);
    if (url.pathname === '/jamendo/tracks/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ results: [{ id: '123', name: 'Matin calme', artist_name: 'Artiste', duration: 95, license_ccurl: 'http://creativecommons.org/licenses/by-nc/3.0/', audio: `http://127.0.0.1:${server.address().port}/cdn/123.mp3`, shareurl: 'https://jamendo.test/123' }] }));
    }
    if (url.pathname === '/freesound/search/text/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ results: [{ id: 456, name: 'Pluie sur le toit', username: 'auteur', duration: 12.5, license: 'http://creativecommons.org/publicdomain/zero/1.0/' }] }));
    }
    if (url.pathname === '/freesound/sounds/456/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ id: 456, name: 'Pluie sur le toit', username: 'auteur', license: 'http://creativecommons.org/publicdomain/zero/1.0/', previews: { 'preview-hq-mp3': `http://127.0.0.1:${server.address().port}/cdn/456.mp3` } }));
    }
    if (url.pathname.startsWith('/cdn/')) {
      res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
      return res.end(mp3);
    }
    res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const srv = await startTestServer({
    providers: fakeProviders().providers,
    overrides: { audio: { jamendoClientId: 'jam-id', jamendoBaseUrl: `${base}/jamendo`, freesoundApiKey: 'fs-key', freesoundBaseUrl: `${base}/freesound` } },
  });
  t.after(() => srv.close());

  const caps = await json(srv.base, '/api/capabilities');
  assert.deepEqual(caps.data.audioLibraries.map((s) => [s.id, s.configured]), [['jamendo', true], ['freesound', true]]);
  assert.ok(!JSON.stringify(caps.data).includes('jam-id') && !JSON.stringify(caps.data).includes('fs-key'), 'aucune clé envoyée au navigateur');

  const music = await json(srv.base, `/api/audio/search?source=jamendo&q=matin&category=${encodeURIComponent('Musiques calmes')}`);
  assert.equal(music.status, 200);
  assert.deepEqual(music.data.results[0], { id: '123', source: 'jamendo', title: 'Matin calme', author: 'Artiste', duration: 95, license: 'CC BY-NC (attribution, pas d’usage commercial)', licenseUrl: 'http://creativecommons.org/licenses/by-nc/3.0/', pageUrl: 'https://jamendo.test/123', category: 'Musiques calmes' });
  assert.match(seen.find((s) => s.startsWith('/jamendo/tracks/?')), /client_id=jam-id.*search=matin\+relaxation/);

  const sfx = await json(srv.base, `/api/audio/search?source=freesound&q=pluie&category=${encodeURIComponent('Sons d’ambiance')}`);
  assert.equal(sfx.data.results[0].license, 'CC0 (domaine public)');

  const file = await fetch(`${srv.base}/api/audio/file?source=freesound&id=456`);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('content-type'), 'audio/mpeg');
  assert.equal(JSON.parse(decodeURIComponent(file.headers.get('x-solvex-audio'))).author, 'auteur');
  assert.equal((await fetch(`${srv.base}/api/audio/file?source=jamendo&id=123`)).status, 200);

  // Only numeric ids, only configured sources.
  assert.equal((await fetch(`${srv.base}/api/audio/file?source=jamendo&id=http://evil`)).status, 400);
  assert.equal((await fetch(`${srv.base}/api/audio/search?source=spotify`)).status, 400);
});
