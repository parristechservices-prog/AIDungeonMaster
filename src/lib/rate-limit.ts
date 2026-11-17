/**
 * Minimal in-memory sliding-window rate limiter for the turn API.
 *
 * Best-effort only: state lives in process memory, so on serverless hosts
 * (Vercel) each instance has its own counters. It still caps runaway clients
 * and accidental loops; use a shared store (KV/Redis) for hard cost guarantees.
 */

export interface LimitResult {
  allowed: boolean;
  /** Seconds until the oldest hit leaves the window (0 when allowed). */
  retryAfterSeconds: number;
}

export class SlidingWindowLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Record a hit for `key` and report whether it is within the limit. A limit <= 0 disables it. */
  check(key: string, now: number = Date.now()): LimitResult {
    if (this.limit <= 0) return { allowed: true, retryAfterSeconds: 0 };
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + this.windowMs - now) / 1000)) };
    }
    recent.push(now);
    this.hits.set(key, recent);
    this.prune(cutoff);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  /** Drop idle keys so the map cannot grow without bound. */
  private prune(cutoff: number): void {
    if (this.hits.size < 1000) return;
    for (const [key, times] of this.hits) {
      if (times.every((t) => t <= cutoff)) this.hits.delete(key);
    }
  }
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

const WINDOW_MS = 60_000;
let sessionLimiter: SlidingWindowLimiter | null = null;
let ipLimiter: SlidingWindowLimiter | null = null;

/**
 * Check a turn request against per-session and per-IP limits per minute.
 * Env: TURN_LIMIT_PER_MINUTE_SESSION (default 20), TURN_LIMIT_PER_MINUTE_IP (default 60); 0 disables.
 */
export function checkTurnRateLimit(sessionId: string, ip: string): LimitResult {
  sessionLimiter ??= new SlidingWindowLimiter(envInt('TURN_LIMIT_PER_MINUTE_SESSION', 20), WINDOW_MS);
  ipLimiter ??= new SlidingWindowLimiter(envInt('TURN_LIMIT_PER_MINUTE_IP', 60), WINDOW_MS);
  const s = sessionLimiter.check(sessionId);
  if (!s.allowed) return s;
  return ipLimiter.check(ip);
}

/** Test hook: forget cached limiters so env changes take effect. */
export function resetTurnRateLimit(): void {
  sessionLimiter = null;
  ipLimiter = null;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0].trim() : req.headers.get('x-real-ip')) || 'unknown';
}
