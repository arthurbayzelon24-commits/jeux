import { HttpError } from './http.js';

/**
 * Fixed-window-per-minute limiter kept in memory. Good enough for a single
 * process; a multi-instance deployment should move this to a shared store.
 */
export class RateLimiter {
  constructor({ windowMs = 60_000, now = () => Date.now() } = {}) {
    this.windowMs = windowMs;
    this.now = now;
    this.buckets = new Map();
  }

  check(key, limit) {
    if (!limit || limit <= 0) return;
    const now = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket || now - bucket.start >= this.windowMs) {
      bucket = { start: now, count: 0 };
      this.buckets.set(key, bucket);
    }
    if (bucket.count >= limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.start + this.windowMs - now) / 1000));
      const error = new HttpError(429, `Trop de requêtes. Réessayez dans ${retryAfter} s.`, { code: 'rate_limited' });
      error.retryAfter = retryAfter;
      throw error;
    }
    bucket.count += 1;
  }

  prune() {
    const now = this.now();
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.start >= this.windowMs) this.buckets.delete(key);
    }
  }
}
