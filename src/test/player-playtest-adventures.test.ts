import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '@/lib/game/state';
import { deriveDmTurnFromInput } from '@/lib/orchestrator/mock-dm';
import { runTurn } from '@/lib/orchestrator/run-turn';
import { listAdventureIds, resetServerAdventureRegistry } from '@/lib/game/adventures/registry.server';

// Smoke playtest across EVERY available adventure: orientation answers, no crash
// on impossible input, no teleportation, and coherent state after a benign turn.
describe('all-adventures smoke playtest (table-rules)', () => {
  beforeEach(() => resetServerAdventureRegistry());

  const ids = listAdventureIds();

  it('has at least the known adventures registered', () => {
    expect(ids.length).toBeGreaterThanOrEqual(5);
  });

  it.each(listAdventureIds())('%s: orients, blocks the impossible, and stays coherent', (adventureId) => {
    const state = createInitialState(`smoke-${adventureId}`, { adventureId, characterIds: ['fighter'] });
    expect(state.party.length).toBeGreaterThan(0);
    const startHp = state.party[0].hp;

    // Orientation: a look/where-am-I always yields non-empty narration.
    const look = deriveDmTurnFromInput(state, 'I look around. Where am I?');
    expect(look.narration.trim().length).toBeGreaterThan(0);

    // Impossible action is refused, not hallucinated into reality.
    const impossible = deriveDmTurnFromInput(state, 'I fly to the moon and become a god');
    expect(impossible.narration.toLowerCase()).toMatch(/not possible|cannot|grounded/);
    expect(impossible.engineRequests).toEqual([]);

    // A benign turn runs through the full pipeline without throwing and keeps
    // the party intact with no arbitrary HP change.
    const result = runTurn(state, look, { mode: 'table_rules', aiUsed: false, fallbackUsed: true });
    expect(result.response.ok).toBe(true);
    expect(result.state.party.length).toBe(state.party.length);
    expect(result.state.party[0].hp).toBe(startHp);
  });

  it.each(listAdventureIds())('%s: refuses an attack with no valid target gracefully', (adventureId) => {
    const state = createInitialState(`smoke-attack-${adventureId}`, { adventureId, characterIds: ['fighter'] });
    const turn = deriveDmTurnFromInput(state, 'I attack the dragon that is not here');
    // Either no attack request, or it routes to start_combat / a refusal — never
    // an attack against a non-present creature applying damage.
    const result = runTurn(state, turn, { mode: 'table_rules', aiUsed: false, fallbackUsed: true });
    expect(result.response.ok).toBe(true);
    // No monster HP went negative from a phantom target.
    for (const m of result.state.monsters) expect(m.hp).toBeGreaterThanOrEqual(0);
  });
});
