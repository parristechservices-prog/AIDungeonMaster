import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '@/lib/game/state';
import { deriveDmTurnFromInput } from '@/lib/orchestrator/mock-dm';
import { resetServerAdventureRegistry } from '@/lib/game/adventures/registry.server';

// Regression for the live failure: on the Nightstone Chapter 1 road approach,
// "how far away is the drawbridge from me" must return a deterministic numeric
// distance, not vague prose like "you see it in the distance / you wonder...".
describe('drawbridge distance regression (Nightstone Chapter 1, road-to-nightstone)', () => {
  beforeEach(() => resetServerAdventureRegistry());

  function roadState() {
    const state = createInitialState('road-distance-regression', {
      adventureId: 'skt-nightstone-chapter1',
      characterIds: ['fighter'],
    });
    expect(state.sceneId).toBe('road-to-nightstone'); // first playable scene
    return state;
  }

  it('answers the exact failing prompt with a numeric feet distance', () => {
    const turn = deriveDmTurnFromInput(roadState(), 'how far away is the drawbridge from me');
    const n = turn.narration.toLowerCase();
    expect(n).toContain('drawbridge');
    expect(n).toMatch(/\d+\s*feet/); // a concrete distance
    expect(n).not.toMatch(/in the distance|you wonder/); // no vague non-answer
  });

  it('includes a movement implication (normal move / Dash / turns)', () => {
    const turn = deriveDmTurnFromInput(roadState(), 'how far is the drawbridge');
    expect(turn.narration.toLowerCase()).toMatch(/move|dash|turn|speed/);
  });

  it('does not teleport the party to an unreachable landmark', () => {
    const turn = deriveDmTurnFromInput(roadState(), "I run to the giant's tower");
    // No scene advance / movement commit to an unauthored place.
    expect(turn.engineRequests).not.toContainEqual(expect.objectContaining({ kind: 'advance_scene' }));
    expect(turn.narration.toLowerCase()).not.toMatch(/you (?:arrive|reach|are now) (?:at|in) the giant/);
  });
});
