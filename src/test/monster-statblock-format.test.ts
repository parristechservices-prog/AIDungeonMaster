import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MONSTER_REACH_FT,
  DEFAULT_MONSTER_SPEED_FT,
  monsterAttackLines,
  monsterReachFt,
  monsterSpeedFt,
  type MonsterView,
} from '@/lib/play/dev-panel-format';

function monster(over: Partial<MonsterView> = {}): MonsterView {
  return { id: 'm', name: 'Test', hp: 10, maxHp: 10, ac: 12, conditions: [], ...over };
}

describe('monster stat block formatting', () => {
  it('applies tactical-layer defaults when speed/reach are omitted', () => {
    const m = monster();
    expect(monsterSpeedFt(m)).toBe(DEFAULT_MONSTER_SPEED_FT);
    expect(monsterReachFt(m)).toBe(DEFAULT_MONSTER_REACH_FT);
  });

  it('uses authored speed/reach when present', () => {
    const m = monster({ speedFt: 40, reachFt: 10 });
    expect(monsterSpeedFt(m)).toBe(40);
    expect(monsterReachFt(m)).toBe(10);
  });

  it('renders a legacy single melee attack from attackBonus/damage', () => {
    const lines = monsterAttackLines(monster({ attackBonus: 4, damage: '1d6+2' }));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/melee.*\+4.*1d6\+2.*reach 5 ft/);
  });

  it('renders multiple attacks with range/reach for richer monsters', () => {
    const lines = monsterAttackLines(
      monster({
        attacks: [
          { id: 's', name: 'Scimitar', kind: 'melee', attackBonus: 4, damage: '1d6+2', reachFt: 5 },
          { id: 'b', name: 'Shortbow', kind: 'ranged', attackBonus: 4, damage: '1d6+2', rangeFt: 80, longRangeFt: 320 },
        ],
      }),
    );
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(/Shortbow \(ranged\).*range 80\/320 ft/);
  });

  it('returns no attack lines when there is no attack data at all', () => {
    expect(monsterAttackLines(monster())).toEqual([]);
  });
});
