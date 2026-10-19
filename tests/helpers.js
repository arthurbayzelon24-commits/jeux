import { deflateSync } from 'node:zlib';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadConfig } from '../server/config.js';
import { createApp } from '../server/app.js';
import { buildAspects, QUALITY_TIERS, RESOLUTIONS } from '../public/js/shared/imageSizes.js';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Builds a real, valid RGBA PNG filled with one colour. */
export function makePng(width = 32, height = 32, [r, g, b, a] = [66, 99, 255, 255]) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    for (let x = 0; x < width; x += 1) raw.set([r, g, b, a], row + 1 + x * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export const FAKE_MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(64)]);

/** In-memory providers that follow the adapter contract, for tests only. */

export function fakeProviders({ imageDelay = 0, videoPolls = 2, failVideo = false } = {}) {
  const calls = { generate: [], edit: [], start: [], poll: 0 };
  const image = {
    id: 'fake-images',
    label: 'Fake images',
    vendor: 'Fake',
    kind: 'image',
    model: 'fake-image-1',
    requiredEnv: [],
    isConfigured: () => true,
    capabilities: {
      textToImage: true,
      imageToImage: true,
      imageOnly: false,
      edit: true,
      mask: true,
      // Same limits as gpt-image-2, so sizes and « 4K » paths can be tested end to end.
      aspects: buildAspects(['1:1', '16:9', '9:16', '21:9'], ({ width, height }) =>
        width * height > 8_294_400 ? 'Trop grand pour ce modèle.' : width * height < 400_000 ? 'Trop petit pour ce modèle.' : null,
      ),
      resolutions: RESOLUTIONS.map(({ id, label }) => ({ id, label })),
      qualities: QUALITY_TIERS,
      qualitiesUnavailable: [],
      maxImages: 2,
      maxReferenceImages: 2,
      acceptedTypes: ['image/png', 'image/jpeg', 'image/webp'],
      notes: [],
    },
    sizeFor(aspect, resolution) {
      const size = this.capabilities.aspects.find((a) => a.id === aspect)?.resolutions.find((r) => r.id === resolution);
      if (!size) throw Object.assign(new Error(`Combinaison ${aspect} ${resolution} non native.`), { status: 400, code: 'unsupported_option' });
      return { width: size.width, height: size.height };
    },
    async generate(args) {
      calls.generate.push(args);
      if (imageDelay) await new Promise((resolve) => setTimeout(resolve, imageDelay));
      const { width, height } = args.aspect ? this.sizeFor(args.aspect, args.resolution) : { width: 64, height: 64 };
      return Array.from({ length: args.count }, (_, i) => ({ buffer: makePng(width, height, [69 + i * 40, 99, 255, 255]), mime: 'image/png' }));
    },
    async edit(args) {
      calls.edit.push(args);
      return [{ buffer: makePng(64, 64, [139, 92, 246, 255]), mime: 'image/png' }];
    },
  };
  const video = {
    id: 'fake-video',
    label: 'Fake video',
    vendor: 'Fake',
    kind: 'video',
    model: 'fake-video-1',
    requiredEnv: [],
    isConfigured: () => true,
    capabilities: {
      textToVideo: true,
      imageToVideo: true,
      durations: [4, 8],
      aspects: [{ id: '16:9', label: 'Paysage' }],
      resolutions: [{ id: '720p', label: '720p' }],
      reportsProgress: false,
      acceptedTypes: ['image/png', 'image/jpeg'],
      notes: [],
    },
    validate: ({ duration }) => ([4, 8].includes(duration) ? null : 'Durée non prise en charge.'),
    async start(args) {
      calls.start.push(args);
      return { operation: 'operations/fake-1' };
    },
    async poll() {
      calls.poll += 1;
      if (calls.poll < videoPolls) return { state: 'running', progress: null };
      if (failVideo) return { state: 'failed', progress: null, error: 'Refus du fournisseur.' };
      return { state: 'succeeded', progress: null, result: { uri: 'fake' } };
    },
    async download() {
      return { buffer: FAKE_MP4, mime: 'video/mp4' };
    },
  };
  return { providers: [image, video], calls };
}

export async function startTestServer({ providers, overrides = {} } = {}) {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'solvex-test-'));
  const config = loadConfig({ dataDir, videoPollIntervalMs: 5, accessCode: '', ...overrides });
  const app = await createApp(config, { providers });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  return {
    app,
    base,
    config,
    async close() {
      await app.close();
      await rm(dataDir, { recursive: true, force: true });
    },
  };
}

export async function waitFor(fn, { timeout = 8000, interval = 10 } = {}) {
  const start = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - start > timeout) throw new Error('waitFor: délai dépassé');
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

/**
 * Local stand-in for a Chat Completions server (OpenAI format, with
 * streaming): `brain(body)` returns the assistant message the « model »
 * answers. Streamed answers are cut in small chunks and tool calls are split
 * across chunks, like real servers do.
 */
export async function startMockLlm(brain, { failWith } = {}) {
  const { createServer } = await import('node:http');
  const requests = [];
  let closedEarly = 0;
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    requests.push({ auth: req.headers.authorization, body });
    if (failWith) {
      res.writeHead(failWith.status, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: { message: failWith.message, type: 'error' } }));
    }
    const message = await brain(body);
    if (!body.stream) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ model: body.model, choices: [{ index: 0, message, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }] }));
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.on('close', () => !res.writableFinished && (closedEarly += 1));
    const send = (delta) => res.write(`data: ${JSON.stringify({ model: body.model, choices: [{ index: 0, delta }] })}\n\n`);
    const text = message.content || '';
    for (let i = 0; i < text.length; i += 12) {
      send({ content: text.slice(i, i + 12) });
      if (message.slow) await new Promise((r) => setTimeout(r, message.slow));
      if (res.destroyed) return;
    }
    (message.tool_calls || []).forEach((call, index) => {
      const args = call.function.arguments;
      send({ tool_calls: [{ index, id: call.id, type: 'function', function: { name: call.function.name, arguments: args.slice(0, 10) } }] });
      send({ tool_calls: [{ index, function: { arguments: args.slice(10) } }] });
    });
    res.write('data: [DONE]\n\n');
    res.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}/v1`, requests, closedEarly: () => closedEarly, close: () => server.close() };
}

const call = (name, args) => ({ role: 'assistant', content: null, tool_calls: [{ id: `call_${name}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }] });

/**
 * A scripted « model » that follows the SOLVEX instructions on known phrases.
 * It does not replace a real model: it lets tests check every part of the
 * pipeline (tools, validation, context, streaming, errors) deterministically.
 */
export function scriptedBrain(body) {
  const last = body.messages.at(-1);
  const user = [...body.messages].reverse().find((m) => m.role === 'user')?.content || '';
  const system = body.messages[0].content;
  const data = JSON.parse(system.slice(system.lastIndexOf('\n') + 1));
  if (last.role === 'tool') {
    const result = JSON.parse(last.content);
    if (result.error) return { role: 'assistant', content: `Je n’ai pas pu le faire : ${result.error}` };
    if (result.status === 'started') return { role: 'assistant', content: `C’est lancé (création ${result.creation_id}). Le résultat s’affichera dès qu’il sera prêt.` };
    if (result.status === 'awaiting_user_confirmation') return { role: 'assistant', content: 'Voici ma proposition : confirmez-la pour l’appliquer.' };
    if (Array.isArray(result) && result[0]?.title) return { role: 'assistant', content: `Je vous propose : ${result.map((r) => r.title).join(', ')}.` };
    if (result.id && result.clips) return call('propose_project_edit', { summary: 'Ajouter un titre élégant et des fondus.', operations: [{ op: 'add_title', text: result.name, start: 0, duration: 3, style_id: 'elegant-classique' }, { op: 'set_transitions', transition: 'fade' }] });
    return { role: 'assistant', content: 'D’accord.' };
  }
  if (/qu.est-ce qu|explique/i.test(user)) return { role: 'assistant', content: 'Un effet cinématographique combine un format large (21:9), un étalonnage contrasté et des mouvements de caméra lents.', slow: /lent/.test(user) ? 30 : 0 };
  if (/idées/i.test(user)) return { role: 'assistant', content: '1. Un timelapse urbain. 2. Un avant/après. 3. Un tutoriel en 30 s. 4. Une journée en 1 minute. 5. Un défi créatif. Voulez-vous que je génère une image pour l’une d’elles ?' };
  if (/quelque chose de beau/i.test(user)) return { role: 'assistant', content: 'Avec plaisir ! Préférez-vous une image ou une vidéo, et sur quel thème ?' };
  if (/plus lumineuse/i.test(user)) {
    const image = data.creations_recentes.find((c) => c.type === 'image' && c.status === 'succeeded');
    return call('edit_image', { creation_id: image?.id || 'introuvable', mode: 'relight', instruction: 'Rends l’image plus lumineuse.' });
  }
  if (/vidéo/i.test(user) && /crée|génère/i.test(user)) return call('generate_video', { prompt: 'Vaisseau traversant une nébuleuse, travelling lent', aspect: '16:9', duration: 8, camera: 'travelling-avant' });
  if (/format impossible/i.test(user)) return call('generate_image', { prompt: 'x', aspect: '7:3' });
  if (/efface|supprime tout/i.test(user)) return call('delete_all_creations', {});
  if (/fichier secret/i.test(user)) return call('get_creation', { creation_id: '../../.env' });
  if (/image/i.test(user) && /crée|génère/i.test(user)) return call('generate_image', { prompt: 'Ville futuriste sous la pluie, néons, reflets sur le bitume', aspect: '16:9', resolution: '1080p', style: 'cinematique' });
  if (/musique/i.test(user)) return call('search_music', { query: 'calme piano' });
  if (/mon projet/i.test(user)) return call('get_project', {});
  if (/retiens/i.test(user)) return call('remember_preference', { text: 'Préfère le format vertical 9:16.' });
  return { role: 'assistant', content: `Réponse à : ${user.slice(0, 60)}` };
}
