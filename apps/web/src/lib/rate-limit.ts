/**
 * Simple in-memory rate limiter for login (single-node / dev).
 * Production multi-instance deployments should use Redis or equivalent.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((existing.resetAt - now) / 1000),
    };
  }
  existing.count += 1;
  return { ok: true };
}

/** Login: 10 attempts per 15 minutes per IP+email key */
export function limitLogin(ip: string, email: string) {
  return rateLimit(`login:${ip}:${email.toLowerCase()}`, 10, 15 * 60 * 1000);
}
