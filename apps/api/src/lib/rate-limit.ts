/**
 * Simple in-memory sliding-window rate limiter.
 * Good enough for a POC; in production use Redis / edge rate limiting.
 */

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; remaining: 0; retryAfterMs: number };

/**
 * @param key unique key e.g. `unlock:${token}:${ip}`
 * @param limit max attempts in the window
 * @param windowMs window size in ms
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0]!;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, windowMs - (now - oldest)),
    };
  }

  bucket.timestamps.push(now);
  return { allowed: true, remaining: limit - bucket.timestamps.length };
}

/** Periodically drop empty/stale buckets to avoid unbounded growth */
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < 15 * 60_000);
    if (bucket.timestamps.length === 0) buckets.delete(key);
  }
}, 60_000).unref?.();
