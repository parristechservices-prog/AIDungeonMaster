import { beforeEach, describe, expect, it } from 'vitest';
import { runTurn } from '@/lib/orchestrator/run-turn';
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

describe('Nightstone open-ended Director actions', () => {
  const mode = { mode: 'ai_director', aiUsed: true, fallbackUsed: false } as const;

  it('lets a successful improvised check reveal something without changing scenes', () => {
    const state = nightstone();
    const turn = runTurn(state, {
      narration: 'You use a bit of chalk to mark the tracks.',
      engineRequests: [{ kind: 'skill_check', characterId: state.activeCharacterId, skill: 'investigation', dc: 10, reason: 'Compare the tracks' }],
    }, { ...mode, manualRoll: 20 });
    expect(turn.response.engineResults[0]?.ok).toBe(true);
    expect(turn.state.sceneId).toBe(state.sceneId);
  });

  it('does not resolve a follow-up stealth check at an unreachable destination', () => {
    const state = nightstone();
    const turn = runTurn(state, {
      narration: 'You try to reach the square and sneak past its occupants.',
      engineRequests: [
        { kind: 'move_area', actorId: state.activeCharacterId, targetAreaId: 'south_square' },
        { kind: 'skill_check', characterId: state.activeCharacterId, skill: 'stealth', dc: 10, reason: 'Sneak past the creatures in the square' },
      ],
    }, { ...mode, manualRoll: 20 });
    expect(turn.response.engineResults).toMatchObject([{ kind: 'move_area', ok: false }]);
    expect(turn.state.exploration?.locations).toEqual(state.exploration?.locations);
  });

  it('does not move or advance after a failed attempt to sneak', () => {
    const state = nightstone();
    const turn = runTurn(state, {
      narration: 'You try using the shadows to reach the square.',
      engineRequests: [
        { kind: 'skill_check', characterId: state.activeCharacterId, skill: 'stealth', dc: 15, reason: 'Sneak into the square' },
        { kind: 'move_area', actorId: state.activeCharacterId, targetAreaId: 'south_square' },
        { kind: 'advance_scene' },
      ],
    }, { ...mode, manualRoll: 1 });
    expect(turn.response.engineResults).toHaveLength(1);
    expect(turn.response.engineResults[0]?.ok).toBe(false);
    expect(turn.state.sceneId).toBe(state.sceneId);
    expect(turn.state.exploration?.locations).toEqual(state.exploration?.locations);
  });
});

it('resumes a compound action at the pending die without replaying earlier requests', () => {
  const state = nightstone();
  const mode = { mode: 'ai_director', aiUsed: true, fallbackUsed: false, physicalDice: true } as const;
  const check = { kind: 'skill_check', characterId: state.activeCharacterId, skill: 'investigation', dc: 10, reason: 'Examine the debris' };
  const first = runTurn(state, {
    narration: 'You look for a way through.',
    engineRequests: [{ kind: 'query_current_area', actorId: state.activeCharacterId }, check, check],
  }, mode);
  expect(first.response.engineResults).toHaveLength(2);
  expect(first.pendingTurn?.engineRequests).toEqual([check, check]);
  const resumed = runTurn(first.state, first.pendingTurn, { ...mode, manualRoll: 20 });
  expect(resumed.response.engineResults.map(result => result.kind)).toEqual(['skill_check', 'skill_check']);
  expect(resumed.response.needsManualRoll).toBe(true);
  expect(resumed.pendingTurn?.engineRequests).toEqual([check]);
});
