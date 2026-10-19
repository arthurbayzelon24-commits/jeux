import { deflateSync } from 'node:zlib';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadConfig } from '../server/config.js';
import { createApp } from '../server/app.js';

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
      aspects: [
        { id: '1:1', label: 'Carré', resolutions: ['standard'] },
        { id: '16:9', label: 'Paysage', resolutions: ['standard'] },
      ],
      resolutions: [{ id: 'standard', label: 'Standard' }],
      qualities: [{ id: 'auto', label: 'Auto' }],
      maxImages: 2,
      maxReferenceImages: 2,
      acceptedTypes: ['image/png', 'image/jpeg', 'image/webp'],
      notes: [],
    },
    sizeFor: () => '64x64',
    async generate(args) {
      calls.generate.push(args);
      if (imageDelay) await new Promise((resolve) => setTimeout(resolve, imageDelay));
      return Array.from({ length: args.count }, (_, i) => ({ buffer: makePng(64, 64, [69 + i * 40, 99, 255, 255]), mime: 'image/png' }));
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

export async function waitFor(fn, { timeout = 3000, interval = 10 } = {}) {
  const start = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - start > timeout) throw new Error('waitFor: délai dépassé');
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
