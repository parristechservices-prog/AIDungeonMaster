import { describe, expect, it } from 'vitest';
import { createInitialState, advanceScene } from '@/lib/game/state';
import { deriveDmTurnFromInput, mockNarrationAfterResult } from '@/lib/orchestrator/mock-dm';

describe('mock DM hints', () => {
  it('nudges exploration phrasing while still in social scene', () => {
    const state = createInitialState('hint-1');
    const turn = deriveDmTurnFromInput(state, 'I inspect the tracks');
    expect(turn.narration.toLowerCase()).toMatch(/gathering leads|before moving on/);
  });

  it('answers questions about the player appearance directly', () => {
    const state = createInitialState('hint-appearance', {
      adventureId: 'skt-nightstone-starter',
      characterIds: ['fighter'],
    });
    const turn = deriveDmTurnFromInput(state, 'what do i look like?');
    expect(turn.engineRequests).toEqual([]);
    expect(turn.narration.toLowerCase()).toContain('you are');
    expect(turn.narration.toLowerCase()).toContain('fighter');
  });

  it('answers distance questions with explicit feet estimates', () => {
    const atDrawbridge = advanceScene(createInitialState('hint-distance', {
      adventureId: 'skt-nightstone-starter',
      characterIds: ['fighter'],
    }));
    const inSquare = advanceScene(atDrawbridge);
    const turn = deriveDmTurnFromInput(inSquare, 'how many feet am i from the bridge?');
    expect(turn.engineRequests).toEqual([]);
    expect(turn.narration.toLowerCase()).toContain('about');
    expect(turn.narration.toLowerCase()).toContain('feet');
  });

  it('answers tactical distance questions even during combat scenes', () => {
    const atDrawbridge = advanceScene(createInitialState('hint-combat-distance', {
      adventureId: 'skt-nightstone-starter',
      characterIds: ['fighter'],
    }));
    const inSquare = advanceScene(atDrawbridge);

    const turn = deriveDmTurnFromInput(inSquare, 'how many feet am i from the drawbridge?');

    expect(turn.engineRequests).toEqual([]);
    expect(turn.narration.toLowerCase()).toContain('drawbridge');
    expect(turn.narration.toLowerCase()).toContain('feet');
  });

  it('appends retry guidance on social skill failure', () => {
    const state = createInitialState('hint-2');
    const line = mockNarrationAfterResult(state, 'skill_check', false);
    expect(line).toBeTruthy();
    expect(line!.toLowerCase()).toMatch(/try|again|coin|insight/);
  });
});
