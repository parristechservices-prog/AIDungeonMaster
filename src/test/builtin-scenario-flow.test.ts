import { afterEach, describe, expect, it } from 'vitest';
import { resetRandomProvider, setRandomProvider } from '@/lib/engine';
import { createInitialState } from '@/lib/game/state';
import { SCENARIOS } from '@/lib/game/scenarios';
import { deriveDmTurnFromInput } from '@/lib/orchestrator/mock-dm';
import { runTurn } from '@/lib/orchestrator/run-turn';

describe('built-in scenario offline flows', () => {
  afterEach(() => resetRandomProvider());

  it.each(SCENARIOS.map((scenario) => [scenario.id, scenario] as const))(
    'completes %s in deterministic Table Rules mode',
    (adventureId, scenario) => {
      setRandomProvider(() => 0.99);
      let state = createInitialState(`offline-${adventureId}`, { adventureId, characterId: 'fighter' });
      const actions = ['I ask the NPC what they know', 'I inspect the area', ...Array(12).fill('I attack')];

      for (const action of actions) {
        state = runTurn(state, deriveDmTurnFromInput(state, action), {
          mode: 'table_rules',
          aiUsed: false,
          fallbackUsed: true,
        }).state;
        if (state.sceneId === 'ending') break;
      }

      expect(state.sceneId).toBe('ending');
      for (const scene of Object.values(scenario.scenes)) {
        expect(scene.forbidden.length).toBeGreaterThan(0);
        expect(scene.successConditions.length).toBeGreaterThan(0);
      }
    },
  );
});
