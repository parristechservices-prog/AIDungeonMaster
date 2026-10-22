type RateBucket = { startedAt: number; count: number };
const buckets = new Map<string, RateBucket>();

export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // CLI/tests/non-browser clients do not always send Origin.
  try {
    return new URL(origin).origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Returns retry-after seconds, or 0 when the request is allowed. */
export function consumeRateLimit(key: string, limit = 30, windowMs = 60_000): number {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    buckets.set(key, { startedAt: now, count: 1 });
    pruneBuckets(now, windowMs);
    return 0;
  }
  current.count += 1;
  if (current.count <= limit) return 0;
  return Math.max(1, Math.ceil((current.startedAt + windowMs - now) / 1000));
}

export function validRequestId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 100 && /^[A-Za-z0-9._:-]+$/.test(value);
}

function pruneBuckets(now: number, windowMs: number): void {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (now - bucket.startedAt >= windowMs * 2) buckets.delete(key);
  }
}
