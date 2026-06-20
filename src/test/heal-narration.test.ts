import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '@/lib/game/state';
import { validateNarrationAgainstState } from '@/lib/llm/validate-narration';
import {
  DEFAULT_NARRATION_REPAIR_ATTEMPTS,
  MAX_NARRATION_REPAIR_ATTEMPTS,
  getNarrationRepairAttempts,
  healNarration,
} from '@/lib/orchestrator/heal-narration';
import type { Monster } from '@/lib/game/types';

function downedMonster(name: string): Monster {
  return { id: 'm1', name, ac: 13, maxHp: 7, hp: 0, attackBonus: 4, damage: '1d6+2', conditions: [] };
}

describe('dead-monster detector', () => {
  it('flags a downed monster narrated as taking an offensive action', () => {
    const state = createInitialState('test');
    state.monsters = [downedMonster('Goblin')];
    const warnings = validateNarrationAgainstState('The Goblin lunges at you with its blade.', state);
    expect(warnings.some((w) => w.includes('Goblin'))).toBe(true);
  });

  it('does not flag a downed monster merely being described as fallen', () => {
    const state = createInitialState('test');
    state.monsters = [downedMonster('Goblin')];
    const warnings = validateNarrationAgainstState('The Goblin lies motionless on the floor.', state);
    expect(warnings).toHaveLength(0);
  });

  it('does not flag a living monster that attacks', () => {
    const state = createInitialState('test');
    const monster = downedMonster('Goblin');
    monster.hp = 7;
    state.monsters = [monster];
    const warnings = validateNarrationAgainstState('The Goblin attacks you.', state);
    expect(warnings).toHaveLength(0);
  });
});

describe('getNarrationRepairAttempts', () => {
  const original = process.env.PARTYQUEST_NARRATION_REPAIR_ATTEMPTS;
  afterEach(() => {
    if (original === undefined) delete process.env.PARTYQUEST_NARRATION_REPAIR_ATTEMPTS;
    else process.env.PARTYQUEST_NARRATION_REPAIR_ATTEMPTS = original;
  });

  it('defaults when unset', () => {
    delete process.env.PARTYQUEST_NARRATION_REPAIR_ATTEMPTS;
    expect(getNarrationRepairAttempts()).toBe(DEFAULT_NARRATION_REPAIR_ATTEMPTS);
  });

  it('reads a valid value', () => {
    process.env.PARTYQUEST_NARRATION_REPAIR_ATTEMPTS = '3';
    expect(getNarrationRepairAttempts()).toBe(3);
  });

  it('clamps above the ceiling', () => {
    process.env.PARTYQUEST_NARRATION_REPAIR_ATTEMPTS = '99';
    expect(getNarrationRepairAttempts()).toBe(MAX_NARRATION_REPAIR_ATTEMPTS);
  });

  it('falls back to default on garbage', () => {
    process.env.PARTYQUEST_NARRATION_REPAIR_ATTEMPTS = 'nonsense';
    expect(getNarrationRepairAttempts()).toBe(DEFAULT_NARRATION_REPAIR_ATTEMPTS);
  });
});

describe('healNarration', () => {
  const results = [
    { kind: 'player_attack', ok: true, summary: 'Hit Goblin for 7 damage.', breakdown: { rolls: [4], total: 7 } },
  ];

  it('returns the original narration untouched when there are no contradictions', async () => {
    const state = createInitialState('test');
    const reprompt = vi.fn();
    const out = await healNarration({
      narration: 'Your blade bites deep and the goblin reels.',
      state,
      engineResults: results,
      reprompt,
    });
    expect(out.narration).toBe('Your blade bites deep and the goblin reels.');
    expect(out.warnings).toHaveLength(0);
    expect(out.attempts).toBe(0);
    expect(reprompt).not.toHaveBeenCalled();
  });

  it('re-prompts with the contradictions and accepts a corrected rewrite', async () => {
    const state = createInitialState('test');
    const reprompt = vi.fn().mockResolvedValue('Your blade lands true.');
    const out = await healNarration({
      narration: 'You dealt 99 damage.',
      state,
      engineResults: results,
      reprompt,
      maxAttempts: 2,
    });
    expect(reprompt).toHaveBeenCalledTimes(1);
    expect(reprompt.mock.calls[0][0].join(' ')).toContain('99');
    expect(out.narration).toBe('Your blade lands true.');
    expect(out.usedEngineSafeFallback).toBe(false);
    expect(out.attempts).toBe(1);
  });

  it('exhausts attempts then falls back to engine-safe narration', async () => {
    const state = createInitialState('test');
    const reprompt = vi.fn().mockResolvedValue('You dealt 99 damage.'); // never improves
    const out = await healNarration({
      narration: 'You dealt 99 damage.',
      state,
      engineResults: results,
      reprompt,
      maxAttempts: 2,
    });
    expect(reprompt).toHaveBeenCalledTimes(2);
    expect(out.usedEngineSafeFallback).toBe(true);
    expect(out.narration).toBe('Hit Goblin for 7 damage.');
  });

  it('falls back immediately when the narrator is unavailable', async () => {
    const state = createInitialState('test');
    const reprompt = vi.fn().mockResolvedValue(null);
    const out = await healNarration({
      narration: 'You dealt 99 damage.',
      state,
      engineResults: results,
      reprompt,
      maxAttempts: 3,
    });
    expect(reprompt).toHaveBeenCalledTimes(1);
    expect(out.usedEngineSafeFallback).toBe(true);
    expect(out.narration).toBe('Hit Goblin for 7 damage.');
  });
});
