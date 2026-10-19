export class HttpError extends Error {
  constructor(status, message, { code = 'error', details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function sendJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

export function sendError(res, error) {
  if (error instanceof HttpError) {
    const headers = error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {};
    sendJson(res, error.status, { error: { code: error.code, message: error.message, details: error.details } }, headers);
    return;
  }
  console.error('[solvex] erreur interne :', error);
  sendJson(res, 500, { error: { code: 'internal', message: 'Une erreur interne est survenue. Réessayez dans un instant.' } });
}

export async function readBody(req, limitBytes) {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > limitBytes) {
    throw new HttpError(413, `Fichier trop volumineux (maximum ${Math.round(limitBytes / 1024 / 1024)} Mo).`, { code: 'too_large' });
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) {
      throw new HttpError(413, `Fichier trop volumineux (maximum ${Math.round(limitBytes / 1024 / 1024)} Mo).`, { code: 'too_large' });
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function readJson(req, limitBytes = 64 * 1024) {
  const type = req.headers['content-type'] || '';
  if (!type.includes('application/json')) {
    throw new HttpError(415, 'Le corps de la requête doit être au format JSON.', { code: 'unsupported_media_type' });
  }
  const raw = await readBody(req, limitBytes);
  if (raw.length === 0) return {};
  try {
    const parsed = JSON.parse(raw.toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return parsed;
  } catch {
    throw new HttpError(400, 'JSON invalide.', { code: 'invalid_json' });
  }
}

export function clientIp(req, trustProxy) {
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

export function parseCookies(header = '') {
  const cookies = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      // Ignore malformed cookie values.
    }
  }
  return cookies;
}
