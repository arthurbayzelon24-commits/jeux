import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAIImageProvider, isFixedSizeModel } from '../server/providers/openaiImages.js';
import { createVeoProvider } from '../server/providers/googleVeo.js';
import { createPollinationsProvider } from '../server/providers/pollinations.js';
import { loadConfig } from '../server/config.js';
import { makePng } from './helpers.js';

function mockFetch(responder) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    const { status = 200, body = {}, raw } = await responder(url, init, calls.length);
    return new Response(raw ?? JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
  return { fetchImpl, calls };
}

const config = (overrides = {}) =>
  loadConfig({
    openai: { apiKey: 'sk-test', baseUrl: 'https://api.openai.test/v1', imageModel: 'gpt-image-2', textModel: '', ...overrides.openai },
    google: {
      apiKey: 'g-test',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      videoModel: 'veo-3.1-generate-preview',
      ...overrides.google,
    },
  });

const b64 = makePng(16, 16).toString('base64');

test('OpenAI : texte vers image envoie modèle, taille, nombre et qualité', async () => {
  const { fetchImpl, calls } = mockFetch(() => ({ body: { data: [{ b64_json: b64 }, { b64_json: b64 }] } }));
  const provider = createOpenAIImageProvider(config(), { fetchImpl });
  const images = await provider.generate({ prompt: 'un chat', aspect: '16:9', resolution: 'high', quality: 'high', count: 2 });
  assert.equal(images.length, 2);
  assert.equal(images[0].mime, 'image/png');
  assert.equal(calls[0].url, 'https://api.openai.test/v1/images/generations');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer sk-test');
  assert.deepEqual(JSON.parse(calls[0].init.body), { model: 'gpt-image-2', prompt: 'un chat', n: 2, size: '2048x1152', quality: 'high' });
});

test('OpenAI : les références passent par /images/edits en multipart avec masque', async () => {
  const { fetchImpl, calls } = mockFetch(() => ({ body: { data: [{ b64_json: b64 }] } }));
  const provider = createOpenAIImageProvider(config(), { fetchImpl });
  const ref = { buffer: makePng(16, 16), mime: 'image/png', ext: 'png' };
  await provider.edit({ prompt: 'ajoute un chapeau', images: [ref, ref], mask: { buffer: makePng(16, 16) } });
  assert.equal(calls[0].url, 'https://api.openai.test/v1/images/edits');
  const form = calls[0].init.body;
  assert.ok(form instanceof FormData);
  assert.equal(form.getAll('image[]').length, 2);
  assert.ok(form.get('mask'));
  assert.equal(form.get('prompt'), 'ajoute un chapeau');
  assert.equal(form.get('size'), null, 'sans format, la taille est laissée au modèle');
});

test('OpenAI : gpt-image-1 n’expose que ses trois tailles fixes', () => {
  assert.equal(isFixedSizeModel('gpt-image-1'), true);
  assert.equal(isFixedSizeModel('gpt-image-1-mini'), true);
  assert.equal(isFixedSizeModel('gpt-image-1.5'), true);
  assert.equal(isFixedSizeModel('gpt-image-2'), false);
  const provider = createOpenAIImageProvider(config({ openai: { imageModel: 'gpt-image-1.5' } }));
  assert.deepEqual(
    provider.capabilities.aspects.map((a) => a.id),
    ['1:1', '3:2', '2:3'],
  );
  assert.throws(() => provider.sizeFor('16:9'), /non pris en charge/);
  assert.throws(() => provider.sizeFor('1:1', 'high'), /indisponible/);
});

test('OpenAI : les erreurs du fournisseur deviennent des messages exploitables', async () => {
  const quota = createOpenAIImageProvider(config(), {
    fetchImpl: mockFetch(() => ({ status: 429, body: { error: { message: 'Rate limit' } } })).fetchImpl,
  });
  await assert.rejects(quota.generate({ prompt: 'x', aspect: '1:1', quality: 'auto', count: 1 }), (e) => e.status === 429 && e.retryable);
  const auth = createOpenAIImageProvider(config(), { fetchImpl: mockFetch(() => ({ status: 401, body: {} })).fetchImpl });
  await assert.rejects(auth.generate({ prompt: 'x', aspect: '1:1', quality: 'auto', count: 1 }), /Clé API refusée/);
  const policy = createOpenAIImageProvider(config(), {
    fetchImpl: mockFetch(() => ({ status: 400, body: { error: { message: 'safety system' } } })).fetchImpl,
  });
  await assert.rejects(
    policy.generate({ prompt: 'x', aspect: '1:1', quality: 'auto', count: 1 }),
    (e) => e.status === 400 && /safety system/.test(e.message),
  );
});

test('Veo : démarrage, sondage puis téléchargement', async () => {
  const { fetchImpl, calls } = mockFetch((url, init, n) => {
    if (n === 1) return { body: { name: 'models/veo-3.1-generate-preview/operations/abc123' } };
    if (n === 2) return { body: { name: 'x', done: false } };
    if (n === 3) {
      return {
        body: {
          done: true,
          response: {
            generateVideoResponse: {
              generatedSamples: [{ video: { uri: 'https://generativelanguage.googleapis.com/v1beta/files/f:download?alt=media' } }],
            },
          },
        },
      };
    }
    return { raw: 'MP4DATA' };
  });
  const provider = createVeoProvider(config(), { fetchImpl });
  const startImage = { buffer: makePng(16, 16), mime: 'image/png' };
  const { operation } = await provider.start({ prompt: 'forêt', aspect: '9:16', duration: 8, resolution: '1080p', startImage });
  assert.equal(calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning');
  assert.equal(calls[0].init.headers['x-goog-api-key'], 'g-test');
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body.parameters, { aspectRatio: '9:16', durationSeconds: 8, resolution: '1080p' });
  assert.equal(body.instances[0].image.mimeType, 'image/png');
  assert.equal(typeof body.instances[0].image.bytesBase64Encoded, 'string');

  assert.deepEqual(await provider.poll(operation), { state: 'running', progress: null });
  assert.equal(calls[1].url, 'https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview/operations/abc123');
  const done = await provider.poll(operation);
  assert.equal(done.state, 'succeeded');
  const video = await provider.download(done.result);
  assert.equal(video.buffer.toString(), 'MP4DATA');
  assert.equal(video.mime, 'video/mp4');
});

test('Veo : refus de sécurité, validation et protection de la clé', async () => {
  const filtered = createVeoProvider(config(), {
    fetchImpl: mockFetch(() => ({
      body: { done: true, response: { generateVideoResponse: { raiMediaFilteredReasons: ['Contenu refusé.'] } } },
    })).fetchImpl,
  });
  const state = await filtered.poll('models/m/operations/1');
  assert.equal(state.state, 'failed');
  assert.match(state.error, /Contenu refusé/);

  const provider = createVeoProvider(config());
  assert.equal(provider.validate({ duration: 8, aspect: '16:9', resolution: '1080p' }), null);
  assert.match(provider.validate({ duration: 4, aspect: '16:9', resolution: '1080p' }), /8 s/);
  assert.match(provider.validate({ duration: 30, aspect: '16:9', resolution: '720p' }), /Durée/);
  assert.match(provider.validate({ duration: 8, aspect: '1:1', resolution: '720p' }), /Format/);
  await assert.rejects(provider.download({ uri: 'https://evil.example.com/video.mp4' }), /inattendue/);
  await assert.rejects(provider.poll('../../etc'), /invalide/);
});

test('Pollinations : requête GET sans clé, taille du format, contrôle du type renvoyé', async () => {
  const png = makePng(16, 16);
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return new Response(png, { status: 200, headers: { 'Content-Type': 'image/png' } });
  };
  const cfg = loadConfig({ pollinations: { enabled: true, baseUrl: 'https://image.pollinations.test', model: '' } });
  const provider = createPollinationsProvider(cfg, { fetchImpl });
  const [image] = await provider.generate({ prompt: 'un chat / bleu', aspect: '9:16', resolution: 'standard' });
  assert.equal(image.mime, 'image/png');
  const url = new URL(calls[0]);
  assert.equal(url.pathname, `/prompt/${encodeURIComponent('un chat / bleu')}`);
  assert.equal(url.searchParams.get('width'), '768');
  assert.equal(url.searchParams.get('height'), '1344');
  assert.equal(url.searchParams.has('model'), false);
  const html = createPollinationsProvider(cfg, { fetchImpl: async () => new Response('<html>moved</html>', { status: 200 }) });
  await assert.rejects(html.generate({ prompt: 'x', aspect: '1:1' }), /pas renvoyé d’image/);
  assert.equal(createPollinationsProvider(loadConfig({ pollinations: { enabled: false } })).isConfigured(), false);
});

test('Veo : instruction négative transmise uniquement si fournie', async () => {
  const bodies = [];
  const fetchImpl = async (url, init) => {
    bodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ name: 'models/m/operations/1' }), { status: 200 });
  };
  const provider = createVeoProvider(config(), { fetchImpl });
  await provider.start({ prompt: 'forêt', negativePrompt: 'texte, filigrane', aspect: '16:9', duration: 8, resolution: '720p' });
  await provider.start({ prompt: 'forêt', aspect: '16:9', duration: 8, resolution: '720p' });
  assert.equal(bodies[0].parameters.negativePrompt, 'texte, filigrane');
  assert.equal('negativePrompt' in bodies[1].parameters, false);
});
