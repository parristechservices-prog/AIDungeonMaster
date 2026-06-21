import { describe, expect, it } from 'vitest';
import { resolveEngineRequest } from '@/lib/engine';
import { createInitialState, buildBattleMap } from '@/lib/game/state';
import type { GameState } from '@/lib/game/types';
import type { Cell } from '@/lib/engine/spatial/tactical';

// Attacker at (0,0), target monster at (2,0). attackBonus 5, manualRoll 8 => to-hit 13.
// Base monster AC 12 (a 13 hits). Half cover -> AC 14 (a 13 misses).
function rangedSetup(targetCell?: Cell, blockerAt1?: Partial<Cell>): { state: GameState; heroId: string } {
  const base = createInitialState('sess-cover', { adventureId: 'brindlehook-inn' });
  const heroId = base.activeCharacterId;
  const party = base.party.map((p, i) => (i === 0 ? { ...p, weapon: { name: 'Shortbow', attackBonus: 5, damage: '1d6' } } : p));
  const withMonster: GameState = {
    ...base,
    party,
    player: party[0],
    monsters: [{ id: 'goblin', name: 'Goblin', ac: 12, maxHp: 7, hp: 7, attackBonus: 4, damage: '1d6+2', conditions: [] }],
  };
  const map = buildBattleMap(withMonster);
  map.positions[heroId] = { x: 0, y: 0, z: 0 };
  map.positions.goblin = { x: 2, y: 0, z: 0 };
  if (targetCell) map.cells['2,0'] = targetCell;
  if (blockerAt1) map.cells['1,0'] = { terrain: 'normal', ...blockerAt1 };
  return {
    state: { ...withMonster, combat: { active: true, initiative: [], turnIndex: 0, battleMap: map } },
    heroId,
  };
}

describe('cover in ranged attack resolution', () => {
  it('no cover: a 13 hits AC 12', () => {
    const { state, heroId } = rangedSetup();
    const { result } = resolveEngineRequest(state, { kind: 'player_attack', characterId: heroId, targetId: 'goblin', ranged: true, manualRoll: 8 });
    expect(result.ok).toBe(true);
    expect(result.cover).toBeUndefined();
  });

  it('half cover raises AC by 2 and turns the same hit into a miss', () => {
    const { state, heroId } = rangedSetup({ terrain: 'normal', cover: 'half' });
    const { result } = resolveEngineRequest(state, { kind: 'player_attack', characterId: heroId, targetId: 'goblin', ranged: true, manualRoll: 8 });
    expect(result.ok).toBe(false);
    expect(result.cover).toMatchObject({ kind: 'half', baseAc: 12, bonus: 2, effectiveAc: 14 });
  });

  it('three-quarters cover raises AC by 5', () => {
    const { state, heroId } = rangedSetup({ terrain: 'normal', cover: 'three_quarters' });
    const { result } = resolveEngineRequest(state, { kind: 'player_attack', characterId: heroId, targetId: 'goblin', ranged: true, manualRoll: 8 });
    expect(result.ok).toBe(false);
    expect(result.cover).toMatchObject({ kind: 'three_quarters', bonus: 5, effectiveAc: 17 });
  });

  it('total cover (sight-blocking wall between) blocks the attack entirely', () => {
    const { state, heroId } = rangedSetup(undefined, { blocksSight: true });
    const { result } = resolveEngineRequest(state, { kind: 'player_attack', characterId: heroId, targetId: 'goblin', ranged: true, manualRoll: 20 });
    expect(result.ok).toBe(false);
    expect(result.summary).toMatch(/total cover/i);
    expect(result.cover?.kind).toBe('total');
  });

  it('melee attacks ignore cover (ranged flag not set)', () => {
    const { state, heroId } = rangedSetup({ terrain: 'normal', cover: 'half' });
    const { result } = resolveEngineRequest(state, { kind: 'player_attack', characterId: heroId, targetId: 'goblin', manualRoll: 8 });
    expect(result.ok).toBe(true);
    expect(result.cover).toBeUndefined();
  });

  it('a hit through half cover still exposes cover details for narration', () => {
    const { state, heroId } = rangedSetup({ terrain: 'normal', cover: 'half' });
    // manualRoll 20 -> natural 20 crit auto-hits even through cover; cover still reported.
    const { result } = resolveEngineRequest(state, { kind: 'player_attack', characterId: heroId, targetId: 'goblin', ranged: true, manualRoll: 20 });
    expect(result.ok).toBe(true);
    expect(result.cover).toMatchObject({ kind: 'half', bonus: 2 });
  });
});
