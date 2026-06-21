import { afterEach, describe, expect, it } from 'vitest';
import { resolveEngineRequest, resetRandomProvider, setRandomProvider } from '@/lib/engine';
import { createInitialState, buildBattleMap } from '@/lib/game/state';
import type { GameState, Monster } from '@/lib/game/types';
import type { Cell, GridCoord } from '@/lib/engine/spatial/tactical';

afterEach(() => resetRandomProvider());

function setup(
  monsters: Monster[],
  place: Record<string, GridCoord>,
  opts: { cells?: Record<string, Cell>; heroAc?: number; width?: number; height?: number } = {},
): { state: GameState; heroId: string } {
  const base = createInitialState('sess-mt', { adventureId: 'brindlehook-inn' });
  const heroId = base.activeCharacterId;
  const party = base.party.map((p, i) => (i === 0 ? { ...p, ac: opts.heroAc ?? 15, hp: 30, maxHp: 30, unconscious: false } : p));
  const st: GameState = { ...base, party, player: party[0], monsters };
  const map = buildBattleMap(st);
  if (opts.width) map.width = opts.width;
  if (opts.height) map.height = opts.height;
  for (const [id, pos] of Object.entries(place)) map.positions[id] = pos;
  if (opts.cells) Object.assign(map.cells, opts.cells);
  return { state: { ...st, combat: { active: true, initiative: [{ actorId: heroId, roll: 10 }], turnIndex: 0, battleMap: map } }, heroId };
}

const meleeGoblin = (): Monster => ({ id: 'gob', name: 'Goblin', ac: 13, maxHp: 7, hp: 7, attackBonus: 4, damage: '1d6', conditions: [] });
const reachGoblin = (): Monster => ({ id: 'gob', name: 'Reachy', ac: 13, maxHp: 7, hp: 7, attackBonus: 4, damage: '1d6', conditions: [], attacks: [{ id: 'spear', name: 'Spear', kind: 'melee', attackBonus: 4, damage: '1d6', reachFt: 10 }] });
const rangedOnly = (): Monster => ({ id: 'arc', name: 'Archer', ac: 12, maxHp: 7, hp: 7, attackBonus: 4, damage: '1d6', conditions: [], attacks: [{ id: 'bow', name: 'Bow', kind: 'ranged', attackBonus: 4, damage: '1d6', rangeFt: 80 }] });
const meleeAndRanged = (): Monster => ({ id: 'arc', name: 'Skirmisher', ac: 12, maxHp: 7, hp: 7, attackBonus: 4, damage: '1d6', conditions: [], attacks: [{ id: 'sword', name: 'Sword', kind: 'melee', attackBonus: 4, damage: '1d6', reachFt: 5 }, { id: 'bow', name: 'Bow', kind: 'ranged', attackBonus: 4, damage: '1d6', rangeFt: 80 }] });

describe('monster melee reach', () => {
  it('hits when adjacent', () => {
    setRandomProvider(() => 0.5); // d20 -> 11, +4 = 15 vs AC 15 hits
    const { state, heroId } = setup([meleeGoblin()], { gob: { x: 0, y: 0, z: 0 }, [`__h`]: { x: 0, y: 0, z: 0 } });
    state.combat.battleMap!.positions[heroId] = { x: 1, y: 0, z: 0 };
    const { result } = resolveEngineRequest(state, { kind: 'monster_turn' });
    expect(result.ok).toBe(true);
    expect(result.summary).toMatch(/hit/i);
  });

  it('a 10 ft reach monster can attack from 10 ft', () => {
    setRandomProvider(() => 0.5);
    const { state, heroId } = setup([reachGoblin()], { gob: { x: 0, y: 0, z: 0 } });
    state.combat.battleMap!.positions[heroId] = { x: 2, y: 0, z: 0 }; // 10 ft
    const { result } = resolveEngineRequest(state, { kind: 'monster_turn' });
    expect(result.ok).toBe(true);
    expect(result.summary).toMatch(/hit/i);
  });

  it('moves into reach when movement allows, then strikes', () => {
    setRandomProvider(() => 0.5);
    const { state, heroId } = setup([meleeGoblin()], { gob: { x: 0, y: 0, z: 0 } });
    state.combat.battleMap!.positions[heroId] = { x: 3, y: 0, z: 0 }; // 15 ft, speed 30 closes it
    const { state: next, result } = resolveEngineRequest(state, { kind: 'monster_turn' });
    expect(result.ok).toBe(true);
    expect(result.summary).toMatch(/moves into reach/i);
    // attacker actually moved
    expect(next.combat.battleMap!.positions.gob).not.toEqual({ x: 0, y: 0, z: 0 });
  });

  it('cannot reach a target beyond movement + reach', () => {
    const { state, heroId } = setup([meleeGoblin()], { gob: { x: 0, y: 0, z: 0 } }, { width: 14, height: 3 });
    state.combat.battleMap!.positions[heroId] = { x: 10, y: 0, z: 0 }; // 50 ft away
    const { result } = resolveEngineRequest(state, { kind: 'monster_turn' });
    expect(result.ok).toBe(false);
    expect(result.summary).toMatch(/cannot reach/i);
  });

  it('difficult terrain can keep a target out of reach', () => {
    const cells: Record<string, Cell> = {};
    for (let x = 1; x <= 4; x++) cells[`${x},0`] = { terrain: 'difficult' };
    const { state, heroId } = setup([meleeGoblin()], { gob: { x: 0, y: 0, z: 0 } }, { cells, width: 8, height: 1 });
    state.combat.battleMap!.positions[heroId] = { x: 5, y: 0, z: 0 }; // 25 ft, but each step costs 10
    const { result } = resolveEngineRequest(state, { kind: 'monster_turn' });
    expect(result.ok).toBe(false);
    expect(result.summary).toMatch(/cannot reach/i);
  });
});

describe('monster ranged attacks are cover-aware', () => {
  function rangedAt(distCells: number, cells?: Record<string, Cell>) {
    const { state, heroId } = setup([rangedOnly()], { arc: { x: 0, y: 0, z: 0 } }, { cells, heroAc: 15, width: 12, height: 3 });
    state.combat.battleMap!.positions[heroId] = { x: distCells, y: 0, z: 0 };
    return { state, heroId };
  }

  it('hits with no cover', () => {
    setRandomProvider(() => 0.5); // 11 + 4 = 15 vs AC 15
    const { state } = rangedAt(2);
    const { result } = resolveEngineRequest(state, { kind: 'monster_turn' });
    expect(result.ok).toBe(true);
    expect(result.cover).toBeUndefined();
  });

  it('half cover (+2) turns the same shot into a miss', () => {
    setRandomProvider(() => 0.5);
    const { state } = rangedAt(2, { '2,0': { terrain: 'normal', cover: 'half' } });
    const { result } = resolveEngineRequest(state, { kind: 'monster_turn' });
    expect(result.ok).toBe(false);
    expect(result.cover).toMatchObject({ kind: 'half', bonus: 2, effectiveAc: 17 });
  });

  it('three-quarters cover (+5) turns the shot into a miss', () => {
    setRandomProvider(() => 0.5);
    const { state } = rangedAt(2, { '2,0': { terrain: 'normal', cover: 'three_quarters' } });
    const { result } = resolveEngineRequest(state, { kind: 'monster_turn' });
    expect(result.ok).toBe(false);
    expect(result.cover).toMatchObject({ kind: 'three_quarters', bonus: 5 });
  });

  it('total cover (sight-blocking wall) blocks the ranged attack entirely', () => {
    setRandomProvider(() => 0.99);
    const { state } = rangedAt(3, { '2,0': { terrain: 'normal', blocksSight: true } });
    const { result } = resolveEngineRequest(state, { kind: 'monster_turn' });
    expect(result.ok).toBe(false);
    expect(result.summary).toMatch(/no clear shot|line of sight|cover/i);
    expect(result.cover?.kind).toBe('total');
  });

  it('exposes cover details for narration', () => {
    setRandomProvider(() => 0.99); // high roll still hits through half cover
    const { state } = rangedAt(2, { '2,0': { terrain: 'normal', cover: 'half' } });
    const { result } = resolveEngineRequest(state, { kind: 'monster_turn' });
    expect(result.cover).toMatchObject({ kind: 'half', bonus: 2 });
  });
});

describe('monster tactical choice', () => {
  it('prefers melee when already in reach', () => {
    setRandomProvider(() => 0.5);
    const { state, heroId } = setup([meleeAndRanged()], { arc: { x: 0, y: 0, z: 0 } });
    state.combat.battleMap!.positions[heroId] = { x: 1, y: 0, z: 0 }; // adjacent
    const { result } = resolveEngineRequest(state, { kind: 'monster_turn' });
    expect(result.ok).toBe(true);
    expect(result.summary).not.toMatch(/moves into reach/i); // didn't need to move
  });

  it('uses ranged when melee is out of reach but a shot is clear', () => {
    setRandomProvider(() => 0.5);
    const { state, heroId } = setup([meleeAndRanged()], { arc: { x: 0, y: 0, z: 0 } }, { heroAc: 15, width: 12, height: 3 });
    state.combat.battleMap!.positions[heroId] = { x: 8, y: 0, z: 0 }; // 40 ft: too far to melee even after moving 30
    const { state: next, result } = resolveEngineRequest(state, { kind: 'monster_turn' });
    expect(result.ok).toBe(true);
    // ranged attack does not move the attacker
    expect(next.combat.battleMap!.positions.arc).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('reports failure when no legal attack or move exists', () => {
    const { state, heroId } = setup([rangedOnly()], { arc: { x: 0, y: 0, z: 0 } }, { cells: { '2,0': { terrain: 'normal', blocksSight: true } }, width: 12, height: 1 });
    state.combat.battleMap!.positions[heroId] = { x: 4, y: 0, z: 0 }; // total cover, ranged-only -> no fallback
    const { result } = resolveEngineRequest(state, { kind: 'monster_turn' });
    expect(result.ok).toBe(false);
  });
});
