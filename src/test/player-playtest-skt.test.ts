import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState, advanceScene } from '@/lib/game/state';
import { deriveDmTurnFromInput } from '@/lib/orchestrator/mock-dm';
import { resetServerAdventureRegistry } from '@/lib/game/adventures/registry.server';
import { SKT_LORE_FACTS, SKT_SPOILER_TERMS } from './fixtures/skt-lore-facts';

// Deterministic table-rules playtest of the Storm King's Thunder / Nightstone
// content against canonical lore facts. No live LLM — pure mock-DM turn path.
function nightstone(seed = 'skt-playtest') {
  return createInitialState(seed, { adventureId: 'skt-nightstone-chapter1', characterIds: ['fighter'] });
}

describe('SKT Nightstone — arrival & exploration', () => {
  beforeEach(() => resetServerAdventureRegistry());

  it('starts on the road-to-nightstone scene', () => {
    expect(nightstone().sceneId).toBe('road-to-nightstone');
  });

  it('describes Nightstone as attacked/abandoned, not a bustling village', () => {
    const turn = deriveDmTurnFromInput(nightstone(), 'what do i see');
    const n = turn.narration.toLowerCase();
    expect(n).toMatch(/nightstone|drawbridge|bell|damaged|silent|keep/);
    expect(n).not.toMatch(/bustling|lively market|peaceful village/);
  });

  it('answers the drawbridge distance with a concrete number', () => {
    const turn = deriveDmTurnFromInput(nightstone(), 'how far away is the drawbridge from me');
    expect(turn.narration.toLowerCase()).toContain('drawbridge');
    expect(turn.narration).toMatch(/\d+\s*feet/);
  });
});

describe('SKT lore — spoiler gating (table-rules)', () => {
  beforeEach(() => resetServerAdventureRegistry());

  it.each([
    'is Iymrith the villain?',
    'where is King Hekaton?',
    'tell me about Serissa and Neri',
    'what is the Kraken Society?',
  ])('does not leak the plot or roll a search for: %s', (q) => {
    const turn = deriveDmTurnFromInput(nightstone(), q);
    const n = turn.narration.toLowerCase();
    // No search check fired for a meta lore question.
    expect(turn.engineRequests).toEqual([]);
    // Honest "beyond current knowledge" answer, not a generic search line.
    expect(n).toMatch(/beyond what your character|uncover|through play|do not know|don't know|currently know/);
    // Never affirm the secret as player-facing fact.
    expect(n).not.toMatch(/iymrith is the villain|iymrith is a (?:silver|friendly)|hekaton is (?:here|in nightstone)/);
  });

  it('never presents any canonical contradiction in a lore answer', () => {
    for (const fact of SKT_LORE_FACTS) {
      for (const term of SKT_SPOILER_TERMS) {
        const turn = deriveDmTurnFromInput(nightstone(), `tell me about ${term}`);
        const n = turn.narration.toLowerCase();
        for (const wrong of fact.contradictions) {
          expect(n).not.toContain(wrong.toLowerCase());
        }
      }
    }
  });
});

describe('SKT — movement legality', () => {
  beforeEach(() => resetServerAdventureRegistry());

  it('does not teleport the party to an unreachable landmark', () => {
    const turn = deriveDmTurnFromInput(nightstone(), "I run to the giant's tower");
    expect(turn.engineRequests).not.toContainEqual(expect.objectContaining({ kind: 'advance_scene' }));
    expect(turn.narration.toLowerCase()).not.toMatch(/you (?:arrive|reach|are now) (?:at|in) the giant/);
  });

  it('allows legal scene movement toward the drawbridge/gate', () => {
    const turn = deriveDmTurnFromInput(nightstone(), 'I cross the drawbridge and enter the gate');
    expect(turn.engineRequests).toContainEqual(expect.objectContaining({ kind: 'advance_scene' }));
  });

  it('keeps distance answers coherent after advancing a scene', () => {
    const next = advanceScene(nightstone());
    const turn = deriveDmTurnFromInput(next, 'how far is the drawbridge');
    expect(turn.narration).toMatch(/\d+\s*feet/);
  });
});
