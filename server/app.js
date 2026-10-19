import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createAuth } from './lib/auth.js';
import { HttpError, clientIp, sendError } from './lib/http.js';
import { JobManager } from './lib/jobs.js';
import { RateLimiter } from './lib/rateLimit.js';
import { CreationStore } from './lib/store.js';
import { createRegistry } from './providers/registry.js';
import { createApiRoutes } from './routes/api.js';

const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json; charset=utf-8',
};

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' data: blob:; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(self), microphone=(self), display-capture=(self), geolocation=()',
};

export async function createApp(config, { providers, sleep } = {}) {
  const store = new CreationStore(config.dataDir);
  await store.init();
  const registry = createRegistry(config, { providers });
  const jobs = new JobManager({ store, registry, config, sleep });
  const limiter = new RateLimiter();
  const auth = createAuth(config);
  const ip = (req) => clientIp(req, config.trustProxy);
  const routes = createApiRoutes({ config, store, registry, jobs, limiter, auth, ip });

  await jobs.resume();
  await store.pruneUploads(config.uploadTtlMs);
  const housekeeping = setInterval(
    () => {
      limiter.prune();
      store.pruneUploads(config.uploadTtlMs).catch((error) => console.error('[solvex] nettoyage', error));
    },
    5 * 60 * 1000,
  );
  housekeeping.unref();

  async function serveStatic(req, res, pathname) {
    const decoded = decodeURIComponent(pathname);
    const requested = path.normalize(path.join(config.publicDir, decoded));
    if (!requested.startsWith(config.publicDir + path.sep) && requested !== config.publicDir) {
      throw new HttpError(403, 'Accès refusé.');
    }
    let file = requested;
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) {
      file = path.join(file, 'index.html');
      info = await stat(file).catch(() => null);
    }
    if (!info) {
      // Unknown asset paths are real 404s; anything else is a client-side route.
      if (path.extname(decoded)) throw new HttpError(404, 'Fichier introuvable.');
      file = path.join(config.publicDir, 'index.html');
      info = await stat(file);
    }
    const type = STATIC_TYPES[path.extname(file)] || 'application/octet-stream';
    const cache = type.startsWith('text/html') ? 'no-cache' : 'public, max-age=300';
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': type, 'Content-Length': info.size, 'Cache-Control': cache });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const { pathname } = url;
    if (pathname.startsWith('/api/')) {
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
      const candidates = routes.filter((route) => route.pattern.test(pathname));
      if (candidates.length === 0) throw new HttpError(404, 'Point d’accès inconnu.', { code: 'not_found' });
      const route = candidates.find((candidate) => candidate.method === req.method);
      if (!route) throw new HttpError(405, 'Méthode non autorisée.', { code: 'method_not_allowed' });
      if (!route.open && !auth.isAuthenticated(req)) throw new HttpError(401, 'Connexion requise.', { code: 'auth_required' });
      if (req.method !== 'GET' && req.method !== 'HEAD') assertSameOrigin(req);
      return route.handler(req, res, pathname.match(route.pattern), url);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Méthode non autorisée.');
    return serveStatic(req, res, pathname);
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      if (res.headersSent) return res.destroy();
      sendError(res, error);
    });
  });
  server.requestTimeout = 120_000;

  return {
    server,
    store,
    jobs,
    registry,
    close: () =>
      new Promise((resolve) => {
        clearInterval(housekeeping);
        jobs.stop();
        server.close(() => resolve());
        server.closeAllConnections?.();
      }),
  };
}

/** Rejects cross-site state-changing requests (defense in depth with SameSite cookies). */
function assertSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  let host;
  try {
    host = new URL(origin).host;
  } catch {
    throw new HttpError(403, 'Origine invalide.', { code: 'bad_origin' });
  }
  if (host !== req.headers.host) throw new HttpError(403, 'Requête d’une autre origine refusée.', { code: 'bad_origin' });
}
