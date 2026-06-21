import { describe, expect, it } from 'vitest';
import { resolveEngineRequest } from '@/lib/engine';
import { createInitialState, buildBattleMap, migrateGameState } from '@/lib/game/state';
import type { GameState } from '@/lib/game/types';

function combatState(): GameState {
  const base = createInitialState('sess-tac', { adventureId: 'brindlehook-inn' });
  // Force a combat with a known battle map and one monster.
  const withMonster: GameState = {
    ...base,
    monsters: [{ id: 'goblin', name: 'Goblin', ac: 12, maxHp: 7, hp: 7, attackBonus: 4, damage: '1d6+2', conditions: [] }],
    combat: { active: true, initiative: [{ actorId: base.activeCharacterId, roll: 15 }], turnIndex: 0 },
  };
  return { ...withMonster, combat: { ...withMonster.combat, battleMap: buildBattleMap(withMonster) } };
}

describe('tactical engine dispatch', () => {
  it('returns a failure when no battle map is active', () => {
    const state = createInitialState('sess-x', { adventureId: 'brindlehook-inn' });
    const { result } = resolveEngineRequest(state, { kind: 'query_reachable', actorId: state.activeCharacterId });
    expect(result.ok).toBe(false);
    expect(result.summary).toMatch(/no tactical battle map/i);
  });

  it('resolves move_creature and updates the battle map position', () => {
    const state = combatState();
    const heroId = state.activeCharacterId;
    const { state: next, result } = resolveEngineRequest(state, {
      kind: 'move_creature',
      actorId: heroId,
      target: { x: 3, y: 1 },
    });
    expect(result.ok).toBe(true);
    expect(result.tactical?.kind).toBe('move_creature');
    expect(next.combat.battleMap!.positions[heroId]).toMatchObject({ x: 3, y: 1 });
  });

  it('exposes query_reachable through the engine result payload', () => {
    const state = combatState();
    const { result } = resolveEngineRequest(state, { kind: 'query_reachable', actorId: state.activeCharacterId });
    expect(result.ok).toBe(true);
    expect(result.tactical?.kind).toBe('query_reachable');
    if (result.tactical?.kind === 'query_reachable') {
      expect(result.tactical.cells.length).toBeGreaterThan(0);
    }
  });

  it('migrates an old combat save with a legacy grid into a battleMap', () => {
    const state = combatState();
    // Simulate a legacy persisted shape: combat.grid instead of battleMap.
    const legacy = {
      ...state,
      combat: {
        active: true,
        initiative: state.combat.initiative,
        turnIndex: 0,
        grid: { width: 8, height: 6, positions: { [state.activeCharacterId]: { x: 1, y: 1 } } },
      },
    } as unknown as GameState;
    const migrated = migrateGameState(legacy);
    expect(migrated.combat.battleMap).toBeDefined();
    expect(migrated.combat.battleMap!.positions[state.activeCharacterId]).toEqual({ x: 1, y: 1 });
  });
});
