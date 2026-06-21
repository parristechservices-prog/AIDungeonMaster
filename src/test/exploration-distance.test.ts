import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '@/lib/game/state';
import {
  deriveDmTurnFromInput,
  extractSpatialTarget,
  isExplorationDistanceQuestion,
} from '@/lib/orchestrator/mock-dm';
import { resetServerAdventureRegistry } from '@/lib/game/adventures/registry.server';

const NO_BATTLE_MAP = /no tactical battle map/i;

describe('exploration distance intent detection', () => {
  it.each([
    'How far from me to the water',
    'How far am I from the water?',
    'How close is the boathouse?',
    'How long would it take to walk to the dock?',
    'distance to the inn',
    'how many feet to the gate',
    'where is the old boathouse',
  ])('recognises ordinary distance phrasing: %s', (q) => {
    expect(isExplorationDistanceQuestion(q.toLowerCase())).toBe(true);
  });

  it('does not treat resource questions as distance questions', () => {
    expect(isExplorationDistanceQuestion('how many goblins are there')).toBe(false);
    expect(isExplorationDistanceQuestion('how many arrows do i have')).toBe(false);
  });

  it('extracts spatial targets from aliases', () => {
    expect(extractSpatialTarget('how far to the shore')).toBe('the water');
    expect(extractSpatialTarget('where is the boathouse')).toBe('the old boathouse');
    expect(extractSpatialTarget('how far to the dragon palace')).toBeNull();
  });
});

describe('Brindlehook exploration distance (regression for the live bug)', () => {
  beforeEach(() => resetServerAdventureRegistry());
  const brindlehook = () => createInitialState('expl-dist', { adventureId: 'brindlehook-inn', characterIds: ['fighter'] });

  it('"How far from me to the water" gives a useful answer, not "no battle map"', () => {
    const turn = deriveDmTurnFromInput(brindlehook(), 'how far from me to the water');
    expect(turn.engineRequests).toEqual([]);
    expect(turn.narration).not.toMatch(NO_BATTLE_MAP);
    expect(turn.narration.toLowerCase()).toContain('water');
    expect(turn.narration.toLowerCase()).toMatch(/nearby|approximate|don't have an exact|known leads/);
  });

  it('"How far away is the old boathouse?" gives an honest located answer', () => {
    const turn = deriveDmTurnFromInput(brindlehook(), 'how far away is the old boathouse?');
    expect(turn.narration).not.toMatch(NO_BATTLE_MAP);
    expect(turn.narration.toLowerCase()).toContain('boathouse');
  });

  it('an unknown target is not invented; known leads are offered', () => {
    const turn = deriveDmTurnFromInput(brindlehook(), 'how far am i from the dragon palace?');
    expect(turn.narration).not.toMatch(NO_BATTLE_MAP);
    expect(turn.narration.toLowerCase()).toMatch(/don't have an exact|known leads/);
    // does not fabricate the palace as a reached/located place
    expect(turn.narration.toLowerCase()).not.toMatch(/you (?:arrive|reach|are now) (?:at|in) the dragon palace/);
  });
});

describe('SKT drawbridge distance still works (no regression)', () => {
  beforeEach(() => resetServerAdventureRegistry());

  it('gives a numeric feet distance on the Nightstone road', () => {
    const state = createInitialState('expl-dist-skt', { adventureId: 'skt-nightstone-chapter1', characterIds: ['fighter'] });
    const turn = deriveDmTurnFromInput(state, 'how far away is the drawbridge');
    expect(turn.narration).not.toMatch(NO_BATTLE_MAP);
    expect(turn.narration).toMatch(/\d+\s*feet/);
  });
});
