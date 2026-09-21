import "server-only";

/**
 * Simple in-memory rate limiter for a single-process self-hosted app.
 * Not distributed — resets when the server restarts.
 */

interface Entry {
  count: number;
  windowStart: number;
  blockedUntil: number | null;
}

const buckets = new Map<string, Entry>();

interface LimitOptions {
  /** Key (e.g. `login:${ip}`) */
  key: string;
  /** Max attempts allowed inside the window */
  max: number;
  /** Window length in milliseconds */
  windowMs: number;
  /** Cooldown after limit exceeded, in ms */
  cooldownMs: number;
}

export interface LimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

export function checkLimit(opts: LimitOptions): LimitResult {
  const now = Date.now();
  let e = buckets.get(opts.key);

  // If blocked, keep blocked until the cooldown passes.
  if (e?.blockedUntil && e.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((e.blockedUntil - now) / 1000),
    };
  }

  // Start a new window if needed.
  if (!e || now - e.windowStart > opts.windowMs) {
    e = { count: 0, windowStart: now, blockedUntil: null };
    buckets.set(opts.key, e);
  }

  if (e.count >= opts.max) {
    e.blockedUntil = now + opts.cooldownMs;
    return {
      allowed: false,
      retryAfterSec: Math.ceil(opts.cooldownMs / 1000),
    };
  }

  e.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

export function resetLimit(key: string): void {
  buckets.delete(key);
}

// Occasional cleanup so the map doesn't grow forever on long-running servers.
if (typeof globalThis !== "undefined") {
  const g = globalThis as unknown as { __qrs_rl_cleaner?: NodeJS.Timeout };
  if (!g.__qrs_rl_cleaner) {
    g.__qrs_rl_cleaner = setInterval(
      () => {
        const now = Date.now();
        for (const [k, e] of buckets) {
          const stale =
            (e.blockedUntil && e.blockedUntil < now) ||
            now - e.windowStart > 15 * 60 * 1000;
          if (stale) buckets.delete(k);
        }
      },
      5 * 60 * 1000
    );
  }
}