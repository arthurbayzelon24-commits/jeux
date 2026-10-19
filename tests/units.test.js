import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectImage, sniffMime, imageDimensions } from '../server/lib/files.js';
import { RateLimiter } from '../server/lib/rateLimit.js';
import { applyStyle, enhanceLocally } from '../server/lib/prompt.js';
import { createAuth } from '../server/lib/auth.js';
import { FAKE_MP4, makePng } from './helpers.js';

test('sniffMime détecte le vrai type à partir des octets', () => {
  assert.equal(sniffMime(makePng(20, 20)), 'image/png');
  assert.equal(sniffMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Buffer.alloc(20)])), 'image/jpeg');
  assert.equal(sniffMime(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)])), 'image/webp');
  assert.equal(sniffMime(FAKE_MP4), 'video/mp4');
  assert.equal(sniffMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
});

test('inspectImage valide les images et lit leurs dimensions', () => {
  const ok = inspectImage(makePng(40, 30));
  assert.equal(ok.ok, true);
  assert.equal(ok.mime, 'image/png');
  assert.deepEqual([ok.width, ok.height], [40, 30]);
  assert.equal(inspectImage(Buffer.from('ceci n’est pas une image, vraiment pas')).ok, false);
  assert.equal(inspectImage(makePng(8, 8)).ok, false, 'trop petite');
  assert.equal(inspectImage(FAKE_MP4).ok, false, 'une vidéo n’est pas une image importable');
});

test('imageDimensions lit un en-tête JPEG baseline', () => {
  const sof = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x64, 0x00, 0xc8, 0x03, ...Buffer.alloc(16)]);
  assert.deepEqual(imageDimensions(sof, 'image/jpeg'), { width: 200, height: 100 });
});

test('RateLimiter bloque au-delà de la limite puis se réinitialise', () => {
  let now = 0;
  const limiter = new RateLimiter({ windowMs: 1000, now: () => now });
  limiter.check('a', 2);
  limiter.check('a', 2);
  assert.throws(
    () => limiter.check('a', 2),
    (error) => error.status === 429 && error.retryAfter === 1,
  );
  limiter.check('b', 2);
  now = 1000;
  limiter.check('a', 2);
});

test('applyStyle ajoute les descripteurs du style, sauf « personnalisé »', () => {
  assert.match(applyStyle('un chat', 'cinematique'), /cinematic/);
  assert.equal(applyStyle('un chat', 'personnalise'), 'un chat');
  assert.equal(applyStyle('un chat', 'inconnu'), 'un chat');
});

test('enhanceLocally enrichit sans perdre l’idée de départ', () => {
  const result = enhanceLocally('un phare sur une falaise.', { kind: 'image', style: 'realiste' });
  assert.match(result, /^Un phare sur une falaise, /);
  assert.match(result, /style réaliste\.$/);
  assert.match(enhanceLocally('une forêt', { kind: 'video' }), /mouvement de caméra/);
});

test('auth : code d’accès et cookie signé', () => {
  const auth = createAuth({ accessCode: 'secret', sessionSecret: 'k', secureCookies: false });
  assert.equal(auth.enabled, true);
  assert.equal(auth.checkCode('secret'), true);
  assert.equal(auth.checkCode('mauvais'), false);
  const cookie = auth.cookieHeader().split(';')[0];
  assert.equal(auth.isAuthenticated({ headers: { cookie } }), true);
  assert.equal(auth.isAuthenticated({ headers: { cookie: `${cookie}x` } }), false);
  assert.equal(auth.isAuthenticated({ headers: {} }), false);
  assert.equal(createAuth({ accessCode: '' }).isAuthenticated({ headers: {} }), true);
});
