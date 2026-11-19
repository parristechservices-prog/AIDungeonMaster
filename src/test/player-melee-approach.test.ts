import { afterEach, describe, expect, it } from 'vitest';
import { resolveEngineRequest, resetRandomProvider, setRandomProvider } from '@/lib/engine';
import { createInitialState, buildBattleMap } from '@/lib/game/state';
import { distanceBetweenActors } from '@/lib/engine/spatial/tactical';
import type { GameState, Monster } from '@/lib/game/types';

afterEach(() => resetRandomProvider());

const worg = (): Monster => ({ id: 'worg', name: 'Worg', ac: 13, maxHp: 26, hp: 26, attackBonus: 5, damage: '2d6+3', conditions: [] });

function setup(heroX: number, worgX: number): { state: GameState; heroId: string } {
  const base = createInitialState('sess-approach', { adventureId: 'brindlehook-inn' });
  const heroId = base.activeCharacterId;
  const st: GameState = { ...base, monsters: [worg()] };
  const map = buildBattleMap(st);
  map.width = Math.max(map.width, worgX + 2);
  map.positions[heroId] = { x: heroX, y: 0, z: 0 };
  map.positions.worg = { x: worgX, y: 0, z: 0 };
  return {
    state: { ...st, combat: { active: true, initiative: [{ actorId: heroId, roll: 10 }], turnIndex: 0, battleMap: map } },
    heroId,
  };
}

describe('player melee: 5e move-then-attack', () => {
  it('runs into reach with remaining movement, then attacks', () => {
    setRandomProvider(() => 0.95); // high d20 -> hit
    const { state, heroId } = setup(0, 5); // 25 ft apart, 30 ft speed
    const { state: next, result } = resolveEngineRequest(state, { kind: 'player_attack', characterId: heroId, targetId: 'worg' });
    expect(result.summary).toMatch(/moves \d+ ft into reach of Worg/);
    expect(result.summary).toMatch(/Hit Worg/);
    expect(distanceBetweenActors(next.combat.battleMap!, heroId, 'worg')).toBeLessThanOrEqual(5);
    expect(next.monsters[0].hp).toBeLessThan(26);
    expect(next.combat.battleMap!.actors[heroId].actionUsed).toBe(true);
  });

  it('closes as far as possible and keeps the action when the target is too far', () => {
    const { state, heroId } = setup(0, 12); // 60 ft apart, 30 ft speed
    const { state: next, result } = resolveEngineRequest(state, { kind: 'player_attack', characterId: heroId, targetId: 'worg' });
    expect(result.ok).toBe(false);
    expect(result.summary).toMatch(/still \d+ ft away/);
    expect(result.summary).toMatch(/Dash/);
    expect(next.monsters[0].hp).toBe(26);
    expect(next.combat.battleMap!.positions[heroId].x).toBeGreaterThan(0);
    expect(next.combat.battleMap!.actors[heroId].actionUsed).toBeFalsy();
  });

  it('attacks without moving when already adjacent', () => {
    setRandomProvider(() => 0.95);
    const { state, heroId } = setup(0, 1);
    const { state: next, result } = resolveEngineRequest(state, { kind: 'player_attack', characterId: heroId, targetId: 'worg' });
    expect(result.summary).not.toMatch(/moves/);
    expect(next.combat.battleMap!.positions[heroId]).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('a miss still uses the action', () => {
    setRandomProvider(() => 0); // natural 1 -> miss
    const { state, heroId } = setup(0, 1);
    const { state: next, result } = resolveEngineRequest(state, { kind: 'player_attack', characterId: heroId, targetId: 'worg' });
    expect(result.ok).toBe(false);
    expect(next.combat.battleMap!.actors[heroId].actionUsed).toBe(true);
  });

  it('leaves ranged attacks alone', () => {
    setRandomProvider(() => 0.95);
    const { state, heroId } = setup(0, 8);
    const { state: next } = resolveEngineRequest(state, { kind: 'player_attack', characterId: heroId, targetId: 'worg', ranged: true });
    expect(next.combat.battleMap!.positions[heroId]).toEqual({ x: 0, y: 0, z: 0 });
  });
});
