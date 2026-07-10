/**
 * In-memory sliding-window rate limiter.
 *
 * V0 single-server scope. State is held in a module-level Map and
 * does not persist across dev-server restarts (which is fine — the
 * goal is to absorb burst attacks within a single process lifetime,
 * not enforce a global quota across deploys).
 *
 * If/when life-os goes multi-server, swap the Map for Redis, Supabase,
 * or @upstash/ratelimit. The `checkAndConsume()` API is provider-
 * agnostic so the call sites won't change.
 *
 * Threat model:
 *   - Authenticated cost-amplification attacks (Anthropic API spend
 *     via /api/overseer, OAuth state-cookie stuffing via the Google
 *     /start endpoint).
 *   - NOT a defence against unauthenticated DDoS — that needs an
 *     edge layer (Vercel, Cloudflare).
 */

type Timestamp = number;

const buckets = new Map<string, Timestamp[]>();

export type RateLimitResult = {
  allowed: boolean;
  /** Hits in the current window AFTER counting this request. */
  current: number;
  /** Configured max for the window. */
  limit: number;
  /** Milliseconds to wait before the oldest hit drops out — only meaningful when !allowed. */
  retryAfterMs: number;
};

/**
 * Sliding window: drops timestamps older than `windowMs`, then either
 * counts the new request (if under `max`) and returns allowed, or
 * rejects and reports how long until the oldest timestamp expires.
 *
 * Calls with the same `key` share state. Pick a key that combines the
 * user identity and the protected operation, e.g.
 * `"overseer:<userId>"` or `"google_oauth_start:<userId>"`.
 */
export function checkAndConsume(
  key: string,
  windowMs: number,
  max: number,
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  const existing = buckets.get(key) ?? [];
  // Drop expired entries. O(n) per call, fine for n ~= max.
  const fresh: Timestamp[] = [];
  for (const t of existing) {
    if (t > cutoff) fresh.push(t);
  }

  if (fresh.length >= max) {
    // Reject without recording. retryAfterMs = until the oldest hit
    // drops out of the window.
    const oldest = fresh[0];
    buckets.set(key, fresh);
    return {
      allowed: false,
      current: fresh.length,
      limit: max,
      retryAfterMs: Math.max(0, oldest + windowMs - now),
    };
  }

  fresh.push(now);
  buckets.set(key, fresh);
  return {
    allowed: true,
    current: fresh.length,
    limit: max,
    retryAfterMs: 0,
  };
}

/**
 * Test-only: clear all bucket state. Not exported for production use
 * — calling this in a request handler would defeat rate limiting.
 *
 * @internal
 */
export function __resetRateLimitForTests(): void {
  buckets.clear();
}
