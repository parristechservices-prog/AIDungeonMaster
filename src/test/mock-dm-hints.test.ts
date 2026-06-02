import { describe, expect, it } from 'vitest';
import { createInitialState } from '@/lib/game/state';
import { deriveDmTurnFromInput, mockNarrationAfterResult } from '@/lib/orchestrator/mock-dm';

describe('mock DM hints', () => {
  it('nudges exploration phrasing while still in social scene', () => {
    const state = createInitialState('hint-1');
    const turn = deriveDmTurnFromInput(state, 'I inspect the tracks');
    expect(turn.narration.toLowerCase()).toMatch(/courier|quay|bar/);
  });

  it('appends retry guidance on social skill failure', () => {
    const state = createInitialState('hint-2');
    const line = mockNarrationAfterResult(state, 'skill_check', false);
    expect(line).toBeTruthy();
    expect(line!.toLowerCase()).toMatch(/try|again|coin|insight/);
  });
});
