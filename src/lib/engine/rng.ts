/**
 * Seedable random source for the rules engine.
 *
 * By default this is just Math.random, so gameplay is unchanged. Call
 * `seedRng(n)` (tests, bug-report replays) to make every engine roll and
 * random pick deterministic, and `resetRng()` to return to Math.random.
 */

type RandomFn = () => number;

/** mulberry32: small, fast, good-enough PRNG for game rolls (not for security). */
export function createSeededRandom(seed: number): RandomFn {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// null = default: call Math.random at use time (so test spies on Math.random still work).
let source: RandomFn | null = null;

/** Make all subsequent engine randomness deterministic for this seed. */
export function seedRng(seed: number): void {
  source = createSeededRandom(seed);
}

/** Restore the default (non-deterministic) source. */
export function resetRng(): void {
  source = null;
}

/** Float in [0, 1) from the current source. */
export function random(): number {
  return source ? source() : Math.random();
}

/** Integer in [1, sides]. */
export function rollDie(sides: number): number {
  return Math.floor(random() * sides) + 1;
}

/** Uniformly pick an element; the array must be non-empty. */
export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}
