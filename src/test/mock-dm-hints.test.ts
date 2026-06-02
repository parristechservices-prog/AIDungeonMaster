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

  it('treats sneaking left in combat as stealth, not an ft distance question', () => {
    const atDrawbridge = advanceScene(createInitialState('hint-combat-stealth', {
      adventureId: 'skt-nightstone-starter',
      characterIds: ['fighter'],
    }));
    const inSquare = advanceScene(atDrawbridge);

    const turn = deriveDmTurnFromInput(inSquare, 'i want to sneak to the left behind the bell tower room');

    expect(turn.engineRequests).toEqual([
      expect.objectContaining({ kind: 'skill_check', skill: 'stealth' }),
    ]);
    expect(turn.needsResultBeforeNarrating).toBe(true);
    expect(turn.narration.toLowerCase()).toContain('cover');
    expect(turn.narration.toLowerCase()).not.toContain('60 feet');
  });

  it('recognizes the temple-graveyard-inn route as a valid stealth route', () => {
    const atDrawbridge = advanceScene(createInitialState('hint-combat-route', {
      adventureId: 'skt-nightstone-starter',
      characterIds: ['fighter'],
    }));
    const inSquare = advanceScene(atDrawbridge);

    const turn = deriveDmTurnFromInput(inSquare, 'i sneak behind the temple through 6a toward the inn');

    expect(turn.engineRequests).toEqual([
      expect.objectContaining({
        kind: 'skill_check',
        skill: 'stealth',
        reason: expect.stringContaining('behind the temple, through the graveyard route, toward the inn'),
      }),
    ]);
    expect(turn.narration.toLowerCase()).toContain('behind the temple');
    expect(turn.narration.toLowerCase()).toContain('graveyard');
    expect(turn.narration.toLowerCase()).toContain('inn');
  });

  it('offers tactical movement options instead of a generic combat wall', () => {
    const atDrawbridge = advanceScene(createInitialState('hint-combat-move', {
      adventureId: 'skt-nightstone-starter',
      characterIds: ['fighter'],
    }));
    const inSquare = advanceScene(atDrawbridge);

    const turn = deriveDmTurnFromInput(inSquare, 'i walk towards the ringing bell');

    expect(turn.engineRequests).toEqual([]);
    expect(turn.narration.toLowerCase()).toContain('sneak');
    expect(turn.narration.toLowerCase()).toContain('disengage');
    expect(turn.narration.toLowerCase()).toContain('worg');
  });

  it('appends retry guidance on social skill failure', () => {
    const state = createInitialState('hint-2');
    const line = mockNarrationAfterResult(state, 'skill_check', false);
    expect(line).toBeTruthy();
    expect(line!.toLowerCase()).toMatch(/try|again|coin|insight/);
  });
});
