import { afterEach, describe, expect, it } from 'vitest';
import { SlidingWindowLimiter, checkTurnRateLimit, resetTurnRateLimit } from '@/lib/rate-limit';

afterEach(() => {
  delete process.env.TURN_LIMIT_PER_MINUTE_SESSION;
  delete process.env.TURN_LIMIT_PER_MINUTE_IP;
  resetTurnRateLimit();
});

describe('SlidingWindowLimiter', () => {
  it('allows up to the limit then blocks with a retry time', () => {
    const l = new SlidingWindowLimiter(3, 60_000);
    for (let i = 0; i < 3; i++) expect(l.check('a', 1000 + i).allowed).toBe(true);
    const blocked = l.check('a', 2000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(59);
  });

  it('frees capacity once hits leave the window', () => {
    const l = new SlidingWindowLimiter(1, 1000);
    expect(l.check('a', 0).allowed).toBe(true);
    expect(l.check('a', 500).allowed).toBe(false);
    expect(l.check('a', 1001).allowed).toBe(true);
  });

  it('tracks keys independently', () => {
    const l = new SlidingWindowLimiter(1, 1000);
    expect(l.check('a', 0).allowed).toBe(true);
    expect(l.check('b', 0).allowed).toBe(true);
  });

  it('is disabled when the limit is 0', () => {
    const l = new SlidingWindowLimiter(0, 1000);
    for (let i = 0; i < 100; i++) expect(l.check('a', i).allowed).toBe(true);
  });
});

describe('checkTurnRateLimit', () => {
  it('honours the per-session env limit', () => {
    process.env.TURN_LIMIT_PER_MINUTE_SESSION = '2';
    resetTurnRateLimit();
    expect(checkTurnRateLimit('s1', 'ip').allowed).toBe(true);
    expect(checkTurnRateLimit('s1', 'ip').allowed).toBe(true);
    expect(checkTurnRateLimit('s1', 'ip').allowed).toBe(false);
    expect(checkTurnRateLimit('s2', 'ip').allowed).toBe(true);
  });
});
