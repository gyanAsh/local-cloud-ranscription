/**
 * Tiny in-memory fixed-window rate limiter.
 *
 * Good enough to stop credential stuffing / brute force on a single instance
 * and deliberately does not touch the database. If you run multiple instances,
 * put a shared limiter (Redis, Upstash, gateway rate limiting) in front instead.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Hard cap so a flood of unique keys can never grow this map unbounded.
const MAX_BUCKETS = 10_000;

export type RateLimitResult = { ok: true; remaining: number } | { ok: false; retryAfterMs: number };

function sweep(now: number) {
	for (const [key, bucket] of buckets) {
		if (bucket.resetAt <= now) buckets.delete(key);
	}

	// Still full after dropping expired buckets: make room by dropping the
	// oldest insertion-order entries down to 90% capacity.
	if (buckets.size >= MAX_BUCKETS) {
		const overflow = buckets.size - Math.floor(MAX_BUCKETS * 0.9);
		let removed = 0;
		for (const key of buckets.keys()) {
			if (removed++ >= overflow) break;
			buckets.delete(key);
		}
	}
}

/** Counts one attempt for `key` against `limit` per `windowMs`. */
export function checkRateLimit(
	key: string,
	limit: number,
	windowMs: number,
	now = Date.now()
): RateLimitResult {
	const bucket = buckets.get(key);

	if (!bucket || bucket.resetAt <= now) {
		if (buckets.size >= MAX_BUCKETS) sweep(now);
		buckets.set(key, { count: 1, resetAt: now + windowMs });
		return { ok: true, remaining: limit - 1 };
	}

	bucket.count += 1;

	if (bucket.count > limit) {
		return { ok: false, retryAfterMs: bucket.resetAt - now };
	}

	return { ok: true, remaining: limit - bucket.count };
}

/** Best-effort client IP; falls back to a shared bucket if unavailable. */
export function clientKey(getClientAddress: () => string): string {
	try {
		return getClientAddress();
	} catch {
		return 'unknown';
	}
}
