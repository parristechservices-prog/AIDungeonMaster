import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState } from '@/lib/game/state';
import { deriveDmTurnFromInput } from '@/lib/orchestrator/mock-dm';
import { runTurn } from '@/lib/orchestrator/run-turn';
import { resetRandomProvider, setRandomProvider } from '@/lib/engine';

describe('regression flow', () => {
  afterEach(() => resetRandomProvider());

  it('progresses social -> exploration -> combat -> ending under deterministic high rolls', () => {
    setRandomProvider(() => 0.99);

    let state = createInitialState('flow-1');

    // social check succeeds -> exploration
    state = runTurn(state, deriveDmTurnFromInput(state, 'I ask Mira about the courier'), { mode: 'table_rules', aiUsed: false, fallbackUsed: true }).state;
    expect(state.sceneId).toBe('exploration');

    // exploration check succeeds -> combat
    state = runTurn(state, deriveDmTurnFromInput(state, 'I inspect the tracks'), { mode: 'table_rules', aiUsed: false, fallbackUsed: true }).state;
    expect(state.sceneId).toBe('combat');

    // Deterministic crit attacks remove the balanced encounter.
    for (let attack = 0; attack < 40 && state.monsters.some((m) => m.hp > 0); attack += 1) {
      state = runTurn(state, deriveDmTurnFromInput(state, 'I attack'), {
        mode: 'table_rules',
        aiUsed: false,
        fallbackUsed: true,
      }).state;

      // Hack for test: make player immortal and clear action economy
      state = {
        ...state,
        party: state.party.map((p) => ({ ...p, hp: p.maxHp })),
      };
      if (state.combat.battleMap) {
        state = {
          ...state,
          combat: {
            ...state.combat,
            battleMap: {
              ...state.combat.battleMap,
              actors: Object.fromEntries(
                Object.entries(state.combat.battleMap.actors).map(([id, actor]) => [
                  id,
                  { ...actor, actionUsed: false, bonusActionUsed: false },
                ])
              ),
            },
          },
        };
      }
    }
    console.log(state.log);
    expect(state.monsters.every((m) => m.hp <= 0)).toBe(true);
    expect(state.sceneId).toBe('ending');
  });
});
