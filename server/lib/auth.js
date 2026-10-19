import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { parseCookies } from './http.js';

const COOKIE = 'solvex_session';
const MAX_AGE_S = 7 * 24 * 3600;

/**
 * Optional protection for deployments: when SOLVEX_ACCESS_CODE is set, the API
 * requires a signed session cookie obtained by submitting that code.
 * Without an access code the instance is considered personal (local use).
 */
export function createAuth(config) {
  const enabled = Boolean(config.accessCode);
  const secret = config.sessionSecret || randomBytes(32).toString('hex');

  const sign = (payload) => createHmac('sha256', secret).update(payload).digest('base64url');

  function issue() {
    const expires = Math.floor(Date.now() / 1000) + MAX_AGE_S;
    const payload = `v1.${expires}`;
    return `${payload}.${sign(payload)}`;
  }

  function verify(token) {
    if (typeof token !== 'string') return false;
    const index = token.lastIndexOf('.');
    if (index === -1) return false;
    const payload = token.slice(0, index);
    const expected = Buffer.from(sign(payload));
    const given = Buffer.from(token.slice(index + 1));
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
    const expires = Number(payload.split('.')[1]);
    return Number.isFinite(expires) && expires > Date.now() / 1000;
  }

  return {
    enabled,
    isAuthenticated(req) {
      if (!enabled) return true;
      return verify(parseCookies(req.headers.cookie)[COOKIE]);
    },
    checkCode(code) {
      if (!enabled || typeof code !== 'string') return false;
      const a = Buffer.from(sign(`code.${code}`));
      const b = Buffer.from(sign(`code.${config.accessCode}`));
      return timingSafeEqual(a, b);
    },
    cookieHeader() {
      const secure = config.secureCookies ? '; Secure' : '';
      return `${COOKIE}=${issue()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${MAX_AGE_S}${secure}`;
    },
    clearCookieHeader() {
      return `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
    },
  };
}
