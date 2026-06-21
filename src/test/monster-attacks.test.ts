import { describe, expect, it } from 'vitest';
import { getMonster, monsterAttacks } from '@/lib/game/monsters';
import type { Monster } from '@/lib/game/types';

describe('monster attack metadata', () => {
  it('normalises a legacy single-attack monster into one 5 ft melee attack', () => {
    const goblin = getMonster('goblin');
    const attacks = monsterAttacks(goblin);
    expect(attacks).toHaveLength(1);
    expect(attacks[0]).toMatchObject({ kind: 'melee', attackBonus: goblin.attackBonus, damage: goblin.damage, reachFt: 5 });
  });

  it('honours an explicit reachFt on a legacy monster', () => {
    const reachy: Monster = { id: 'x', name: 'Reacher', ac: 12, maxHp: 10, hp: 10, attackBonus: 5, damage: '1d10', reachFt: 10, conditions: [] };
    expect(monsterAttacks(reachy)[0].reachFt).toBe(10);
  });

  it('exposes multiple attacks (melee + ranged) for a richer monster', () => {
    const archer = getMonster('goblin_archer');
    const attacks = monsterAttacks(archer);
    expect(attacks.map((a) => a.kind).sort()).toEqual(['melee', 'ranged']);
    const ranged = attacks.find((a) => a.kind === 'ranged')!;
    expect(ranged.rangeFt).toBe(80);
    expect(ranged.longRangeFt).toBe(320);
  });

  it('a ranged attack carries the range it needs', () => {
    const skeleton = getMonster('skeleton');
    const ranged = monsterAttacks(skeleton).find((a) => a.kind === 'ranged');
    expect(ranged?.rangeFt).toBeGreaterThan(0);
  });
});
