import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState } from '@/lib/game/state';
import { resolveEngineRequest } from '@/lib/engine';
import { createSeededRandom, pick, resetRng, rollDie, seedRng } from '@/lib/engine/rng';

afterEach(() => resetRng());

describe('seedable rng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    expect(Array.from({ length: 20 }, a)).toEqual(Array.from({ length: 20 }, b));
  });

  it('produces different sequences for different seeds', () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);
    expect(Array.from({ length: 10 }, a)).not.toEqual(Array.from({ length: 10 }, b));
  });

  it('keeps rolls within bounds', () => {
    seedRng(7);
    for (let i = 0; i < 1000; i++) {
      const r = rollDie(20);
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(20);
    }
  });

  it('picks only members of the list', () => {
    seedRng(3);
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) expect(items).toContain(pick(items));
  });

  it('resetRng restores a non-deterministic source', () => {
    seedRng(5);
    const seeded = rollDie(1000000);
    seedRng(5);
    expect(rollDie(1000000)).toBe(seeded);
    resetRng();
    const draws = new Set(Array.from({ length: 20 }, () => rollDie(1000000)));
    expect(draws.size).toBeGreaterThan(1);
  });

  it('makes engine skill checks replayable', () => {
    // Build state first: initial-state setup may itself draw randomness.
    const state = createInitialState('replay');
    const run = (seed: number) => {
      seedRng(seed);
      return resolveEngineRequest(state, { kind: 'skill_check', skill: 'history', dc: 12, reason: 'x' }).result.breakdown;
    };
    expect(run(99)).toEqual(run(99));
  });
});
