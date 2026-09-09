/**
 * Per-socket rate limiting and action dedupe. Spec §58, §68.5.
 */

/** Simple sliding-window counter, keyed per socket + bucket. */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private limit: number,
    private windowMs: number,
  ) {}

  /** Returns true when the call is allowed. */
  allow(key: string, now = Date.now()): boolean {
    const times = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (times.length >= this.limit) {
      this.hits.set(key, times);
      return false;
    }
    times.push(now);
    this.hits.set(key, times);
    return true;
  }

  forget(key: string): void {
    this.hits.delete(key);
  }
}

/**
 * §68.5: an ack that times out will be retried. Without an idempotency key a
 * retried ask becomes two asks, so a repeated actionId returns the original
 * stored result and mutates nothing.
 */
export interface DedupeEntry {
  at: number;
  ok: boolean;
  error?: string;
}

export const DEDUPE_TTL_MS = 5 * 60 * 1000;

export function dedupeGet(
  cache: Map<string, DedupeEntry>,
  actionId: string,
  now = Date.now(),
): DedupeEntry | undefined {
  const hit = cache.get(actionId);
  if (!hit) return undefined;
  if (now - hit.at > DEDUPE_TTL_MS) {
    cache.delete(actionId);
    return undefined;
  }
  return hit;
}

export function dedupeSet(
  cache: Map<string, DedupeEntry>,
  actionId: string,
  entry: Omit<DedupeEntry, "at">,
  now = Date.now(),
): void {
  cache.set(actionId, { ...entry, at: now });

  // Opportunistic prune so the cache cannot grow without bound.
  if (cache.size > 500) {
    for (const [k, v] of cache) {
      if (now - v.at > DEDUPE_TTL_MS) cache.delete(k);
    }
  }
}
