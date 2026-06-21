import { afterEach, describe, expect, it } from 'vitest';
import { resolveEngineRequest, resetRandomProvider, setRandomProvider } from '@/lib/engine';
import { createInitialState, buildBattleMap } from '@/lib/game/state';
import type { GameState } from '@/lib/game/types';

function combatState(): GameState {
  const base = createInitialState('sess-oa', { adventureId: 'brindlehook-inn' });
  const withMonster: GameState = {
    ...base,
    monsters: [{ id: 'ogre', name: 'Ogre', ac: 11, maxHp: 30, hp: 30, attackBonus: 6, damage: '2d8+4', conditions: [] }],
    combat: { active: true, initiative: [{ actorId: base.activeCharacterId, roll: 15 }], turnIndex: 0 },
  };
  const map = buildBattleMap(withMonster);
  // Put hero adjacent to the ogre so moving away leaves its reach.
  map.positions[base.activeCharacterId] = { x: 1, y: 1, z: 0 };
  map.positions.ogre = { x: 0, y: 1, z: 0 };
  return { ...withMonster, combat: { ...withMonster.combat, battleMap: map } };
}

afterEach(() => resetRandomProvider());

describe('opportunity attack resolution', () => {
  it('leaving hostile reach rolls a real OA that hits and damages the mover', () => {
    setRandomProvider(() => 0.99); // high rolls → OA hits, max damage
    const state = combatState();
    const heroId = state.activeCharacterId;
    const startHp = state.party.find((p) => p.id === heroId)!.hp;
    const { state: next, result } = resolveEngineRequest(state, {
      kind: 'move_creature',
      actorId: heroId,
      target: { x: 4, y: 1 },
    });
    expect(result.ok).toBe(true);
    expect(result.opportunityAttacks).toHaveLength(1);
    expect(result.opportunityAttacks![0]).toMatchObject({ attackerId: 'ogre', targetId: heroId, hit: true });
    expect(result.opportunityAttacks![0].damage).toBeGreaterThan(0);
    // HP actually dropped through the engine.
    expect(next.party.find((p) => p.id === heroId)!.hp).toBeLessThan(startHp);
    // Reaction consumed.
    expect(next.combat.battleMap!.actors.ogre.reactionAvailable).toBe(false);
  });

  it('a missed OA applies no damage but still consumes the reaction', () => {
    setRandomProvider(() => 0.0); // natural 1 → miss
    const state = combatState();
    const heroId = state.activeCharacterId;
    const startHp = state.party.find((p) => p.id === heroId)!.hp;
    const { state: next, result } = resolveEngineRequest(state, {
      kind: 'move_creature',
      actorId: heroId,
      target: { x: 4, y: 1 },
    });
    expect(result.opportunityAttacks![0].hit).toBe(false);
    expect(result.opportunityAttacks![0].damage).toBe(0);
    expect(next.party.find((p) => p.id === heroId)!.hp).toBe(startHp);
    expect(next.combat.battleMap!.actors.ogre.reactionAvailable).toBe(false);
  });

  it('Disengage suppresses the opportunity attack', () => {
    setRandomProvider(() => 0.99);
    const state = combatState();
    const heroId = state.activeCharacterId;
    const disengaged = resolveEngineRequest(state, { kind: 'disengage', actorId: heroId });
    const { state: next, result } = resolveEngineRequest(disengaged.state, {
      kind: 'move_creature',
      actorId: heroId,
      target: { x: 4, y: 1 },
    });
    expect(result.opportunityAttacks ?? []).toHaveLength(0);
    expect(next.party.find((p) => p.id === heroId)!.hp).toBe(state.party.find((p) => p.id === heroId)!.hp);
  });

  it('an exhausted reaction means no opportunity attack', () => {
    setRandomProvider(() => 0.99);
    const state = combatState();
    const map = state.combat.battleMap!;
    const drained: GameState = {
      ...state,
      combat: { ...state.combat, battleMap: { ...map, actors: { ...map.actors, ogre: { ...map.actors.ogre, reactionAvailable: false } } } },
    };
    const heroId = state.activeCharacterId;
    const { result } = resolveEngineRequest(drained, { kind: 'move_creature', actorId: heroId, target: { x: 4, y: 1 } });
    expect(result.opportunityAttacks ?? []).toHaveLength(0);
  });

  it('each hostile whose reach is left gets its own OA', () => {
    setRandomProvider(() => 0.99);
    const base = createInitialState('sess-oa2', { adventureId: 'brindlehook-inn' });
    const withMonsters: GameState = {
      ...base,
      monsters: [
        { id: 'ogre', name: 'Ogre', ac: 11, maxHp: 30, hp: 30, attackBonus: 6, damage: '1d8+4', conditions: [] },
        { id: 'goblin', name: 'Goblin', ac: 12, maxHp: 7, hp: 7, attackBonus: 4, damage: '1d6+2', conditions: [] },
      ],
      combat: { active: true, initiative: [{ actorId: base.activeCharacterId, roll: 15 }], turnIndex: 0 },
    };
    const map = buildBattleMap(withMonsters);
    map.positions[base.activeCharacterId] = { x: 1, y: 1, z: 0 };
    map.positions.ogre = { x: 0, y: 1, z: 0 };
    map.positions.goblin = { x: 1, y: 0, z: 0 };
    const state = { ...withMonsters, combat: { ...withMonsters.combat, battleMap: map } };
    const { result } = resolveEngineRequest(state, { kind: 'move_creature', actorId: base.activeCharacterId, target: { x: 4, y: 4 } });
    const attackers = (result.opportunityAttacks ?? []).map((o) => o.attackerId).sort();
    expect(attackers).toEqual(['goblin', 'ogre']);
  });
});
