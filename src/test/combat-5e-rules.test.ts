import { afterEach, describe, expect, it } from 'vitest';
import { resolveEngineRequest, resetRandomProvider, setRandomProvider } from '@/lib/engine';
import { createInitialState, buildBattleMap } from '@/lib/game/state';
import { buildCharacter } from '@/lib/game/characters/templates';
import { getMonster } from '@/lib/game/monsters';
import type { Character, GameState, Monster } from '@/lib/game/types';

afterEach(() => resetRandomProvider());

/** Feed exact die faces: each entry is [face, sides]. Extra calls return 0.5. */
function dice(...faces: [number, number][]) {
  const queue = faces.map(([face, sides]) => (face - 0.5) / sides);
  setRandomProvider(() => (queue.length ? queue.shift()! : 0.5));
}

function monster(id: string, template = 'worg', hp?: number): Monster {
  const m = getMonster(template);
  return { ...m, id, hp: hp ?? m.maxHp };
}

function setup(opts: { level?: number; monsters?: Monster[]; heroPatch?: Partial<Character>; order?: string[]; turn?: number } = {}) {
  const base = createInitialState('sess-5e', { adventureId: 'brindlehook-inn' });
  const hero = { ...buildCharacter('fighter', { level: opts.level ?? 3 }), ...opts.heroPatch };
  const monsters = opts.monsters ?? [monster('worg-1')];
  let st: GameState = { ...base, party: [hero], player: hero, activeCharacterId: hero.id, monsters };
  const map = buildBattleMap(st);
  map.width = Math.max(map.width, 10);
  map.height = Math.max(map.height, 10);
  map.positions[hero.id] = { x: 2, y: 2, z: 0 };
  monsters.forEach((m, i) => { map.positions[m.id] = { x: 3 + i * 2, y: 2, z: 0 }; });
  const order = opts.order ?? [hero.id, ...monsters.map((m) => m.id)];
  st = { ...st, combat: { active: true, initiative: order.map((actorId, i) => ({ actorId, roll: 20 - i })), turnIndex: opts.turn ?? 0, battleMap: map } };
  return { state: st, hero };
}

describe('turn order', () => {
  it('monster_turn acts for the monster whose initiative turn it is', () => {
    const { state, hero } = setup({ monsters: [monster('worg-1'), monster('worg-2')], turn: 2 });
    dice([10, 20]);
    const { result } = resolveEngineRequest(state, { kind: 'monster_turn' });
    expect(result.summary).toMatch(/Worg/);
    // worg-2 acted: it was placed further away, so it had to move.
    expect(result.summary).toMatch(/moves into reach|hit|missed/i);
    const refused = resolveEngineRequest({ ...state, combat: { ...state.combat, turnIndex: 0 } }, { kind: 'monster_turn' });
    expect(refused.result.ok).toBe(false);
    expect(refused.result.summary).toContain(`${hero.name}'s turn`);
  });

  it('end_turn skips dead monsters', () => {
    const { state, hero } = setup({ monsters: [monster('worg-1', 'worg', 0), monster('worg-2')] });
    const { state: next } = resolveEngineRequest(state, { kind: 'end_turn' });
    expect(next.combat.initiative[next.combat.turnIndex].actorId).toBe('worg-2');
    const back = resolveEngineRequest(next, { kind: 'end_turn' });
    expect(back.state.combat.initiative[back.state.combat.turnIndex].actorId).toBe(hero.id);
  });

  it('monsters roll initiative with their Dex modifier', () => {
    expect(getMonster('worg').initiativeBonus).toBe(1);
    expect(getMonster('goblin').initiativeBonus).toBe(2);
    expect(getMonster('ogre').initiativeBonus).toBe(-1);
  });
});

describe('attack rolls', () => {
  it('a natural 1 always misses, even against a low AC', () => {
    const { state, hero } = setup({ monsters: [{ ...monster('worg-1'), ac: 1 }] });
    dice([1, 20]);
    const { result } = resolveEngineRequest(state, { kind: 'player_attack', characterId: hero.id, targetId: 'worg-1' });
    expect(result.ok).toBe(false);
  });

  it('Improved Critical crits on a 19 at level 3, but not at level 2', () => {
    const l3 = setup({ level: 3 });
    dice([19, 20]);
    expect(resolveEngineRequest(l3.state, { kind: 'player_attack', characterId: l3.hero.id, targetId: 'worg-1' }).result.critical).toBe(true);
    const l2 = setup({ level: 2 });
    dice([19, 20]);
    expect(resolveEngineRequest(l2.state, { kind: 'player_attack', characterId: l2.hero.id, targetId: 'worg-1' }).result.critical).toBe(false);
  });

  it('monsters score critical hits on a natural 20 (double dice)', () => {
    const { state } = setup({ turn: 1 });
    dice([20, 20], [6, 6], [6, 6], [6, 6], [6, 6], [20, 20]);
    const { result } = resolveEngineRequest(state, { kind: 'monster_turn' });
    expect(result.summary).toMatch(/Critical hit/);
    expect(result.breakdown?.total).toBe(27); // 4d6 (24) + 3
  });

  it('a monster natural 1 misses', () => {
    const { state, hero } = setup({ turn: 1, heroPatch: { ac: 1 } });
    dice([1, 20]);
    const { state: next, result } = resolveEngineRequest(state, { kind: 'monster_turn' });
    expect(result.summary).toMatch(/missed/);
    expect(next.party[0].hp).toBe(hero.hp);
  });
});

describe('worg bite and prone', () => {
  it('a failed DC 13 Strength save knocks the target prone', () => {
    const { state } = setup({ turn: 1 });
    dice([15, 20], [1, 6], [1, 6], [1, 20]);
    const { state: next, result } = resolveEngineRequest(state, { kind: 'monster_turn' });
    expect(result.summary).toMatch(/knocked prone/);
    expect(next.party[0].conditions).toContain('prone');
  });

  it('standing up at the start of your turn costs half your movement', () => {
    const { state, hero } = setup({ turn: 1, heroPatch: { conditions: ['prone'] } });
    const { state: next, result } = resolveEngineRequest(state, { kind: 'end_turn' });
    expect(result.summary).toMatch(/stand up/);
    expect(next.party[0].conditions).not.toContain('prone');
    expect(next.combat.battleMap!.actors[hero.id].movementSpentFt).toBe(15);
  });

  it('melee attacks against a prone target have advantage', () => {
    const { state, hero } = setup({ monsters: [{ ...monster('worg-1'), conditions: ['prone'] }] });
    dice([2, 20], [18, 20]);
    const { result } = resolveEngineRequest(state, { kind: 'player_attack', characterId: hero.id, targetId: 'worg-1' });
    expect(result.ok).toBe(true);
  });

  it('worgs are Large with 50 ft speed', () => {
    const w = getMonster('worg');
    expect(w.size).toBe('large');
    expect(w.speedFt).toBe(50);
  });
});

describe('dropping to 0 HP', () => {
  it('damage at 0 HP from a hit is one failure; a melee hit within 5 ft crits for two', () => {
    const down = { hp: 0, unconscious: true, deathSaves: { success: 0, failure: 0 } };
    const { state } = setup({ turn: 1, heroPatch: down });
    dice([15, 20]);
    const { state: next, result } = resolveEngineRequest(state, { kind: 'monster_turn' });
    expect(result.summary).toMatch(/two death-save failures/);
    expect(next.party[0].deathSaves.failure).toBe(2);

    const archer = monster('arch', 'goblin_archer');
    const ranged = setup({ turn: 1, monsters: [archer], heroPatch: down });
    ranged.state.combat.battleMap!.positions.arch = { x: 8, y: 2, z: 0 };
    dice([15, 20]);
    const shot = resolveEngineRequest(ranged.state, { kind: 'monster_turn' });
    expect(shot.state.party[0].deathSaves.failure).toBe(1);
  });

  it('massive damage kills outright', () => {
    const { state } = setup({ turn: 1, heroPatch: { hp: 1, maxHp: 10 } });
    dice([15, 20], [6, 6], [6, 6]);
    const { state: next, result } = resolveEngineRequest(state, { kind: 'monster_turn' });
    expect(result.summary).toMatch(/killed outright/);
    expect(next.party[0].deathSaves.failure).toBe(3);
  });

  it('three successes leave the character stable, and stable characters stop rolling', () => {
    const { state, hero } = setup({ heroPatch: { hp: 0, unconscious: true, deathSaves: { success: 2, failure: 0 } } });
    dice([12, 20]);
    const { state: next } = resolveEngineRequest(state, { kind: 'death_save', characterId: hero.id });
    expect(next.party[0].stable).toBe(true);
    const again = resolveEngineRequest(next, { kind: 'death_save', characterId: hero.id });
    expect(again.result.summary).toMatch(/stable/);
  });
});

describe('fighter features', () => {
  it('Second Wind heals and spends the bonus action, not the action', () => {
    const { state, hero } = setup({ heroPatch: { hp: 5 } });
    const { state: next } = resolveEngineRequest(state, { kind: 'use_feature', characterId: hero.id, featureId: 'second_wind' });
    const actor = next.combat.battleMap!.actors[hero.id];
    expect(actor.bonusActionUsed).toBe(true);
    expect(actor.actionUsed).toBe(false);
    expect(next.party[0].hp).toBeGreaterThan(5);
  });

  it('Action Surge gives back the action', () => {
    const { state, hero } = setup();
    dice([2, 20]);
    const attacked = resolveEngineRequest(state, { kind: 'player_attack', characterId: hero.id, targetId: 'worg-1' }).state;
    expect(attacked.combat.battleMap!.actors[hero.id].actionUsed).toBe(true);
    const surged = resolveEngineRequest(attacked, { kind: 'use_feature', characterId: hero.id, featureId: 'action_surge' }).state;
    expect(surged.combat.battleMap!.actors[hero.id].actionUsed).toBe(false);
  });

  it('features and HP follow the 5e fighter at each level', () => {
    const ids = (lvl: number) => buildCharacter('fighter', { level: lvl }).features.map((f) => f.id);
    expect(ids(1)).not.toContain('action_surge');
    expect(ids(2)).toContain('action_surge');
    expect(ids(2)).not.toContain('improved_critical');
    expect(ids(3)).toContain('improved_critical');
    expect(buildCharacter('fighter', { level: 1 }).maxHp).toBe(12);
    expect(buildCharacter('fighter', { level: 2 }).maxHp).toBe(20);
    expect(buildCharacter('fighter', { level: 3 }).maxHp).toBe(28);
    const f = buildCharacter('fighter');
    expect(f.ac).toBe(17);
    expect(f.inventory).toContain('Chain Mail');
  });
});

describe('potions and rests', () => {
  it('a Healing Potion heals 2d4+2, is consumed and uses the action', () => {
    const { state, hero } = setup({ heroPatch: { hp: 3 } });
    dice([4, 4], [4, 4]);
    const { state: next, result } = resolveEngineRequest(state, { kind: 'use_item', characterId: hero.id, item: 'Healing Potion' });
    expect(result.ok).toBe(true);
    expect(next.party[0].hp).toBe(13);
    expect(next.party[0].inventory).not.toContain('Healing Potion');
    expect(next.combat.battleMap!.actors[hero.id].actionUsed).toBe(true);
  });

  it('a potion revives an unconscious ally', () => {
    const { state, hero } = setup({ heroPatch: { hp: 0, unconscious: true, deathSaves: { success: 1, failure: 2 } } });
    const helper = { ...buildCharacter('fighter'), id: 'helper', hp: 20 };
    const st = { ...state, party: [state.party[0], helper] };
    st.combat.battleMap!.actors.helper = { ...st.combat.battleMap!.actors[hero.id], id: 'helper', actionUsed: false };
    const { state: next } = resolveEngineRequest(st, { kind: 'use_item', characterId: 'helper', item: 'Healing Potion', targetId: hero.id });
    expect(next.party[0].unconscious).toBe(false);
    expect(next.party[0].deathSaves).toEqual({ success: 0, failure: 0 });
  });

  it('a short rest spends Hit Dice to heal and recharges Second Wind', () => {
    const { state } = setup({ heroPatch: { hp: 4 } });
    const used = resolveEngineRequest({ ...state, combat: { ...state.combat, active: false } }, { kind: 'use_feature', characterId: state.party[0].id, featureId: 'second_wind' }).state;
    const { state: rested, result } = resolveEngineRequest({ ...used, party: [{ ...used.party[0], hp: 4 }] }, { kind: 'short_rest' });
    expect(result.summary).toMatch(/Hit (Die|Dice)/);
    expect(rested.party[0].hp).toBeGreaterThan(4);
    expect(rested.party[0].hitDice!.remaining).toBeLessThan(3);
    expect(rested.party[0].features.find((f) => f.id === 'second_wind')!.usesRemaining).toBe(1);
  });

  it('a long rest restores HP and half the Hit Dice', () => {
    const { state } = setup({ heroPatch: { hp: 4, hitDice: { die: 10, remaining: 0, max: 3 } } });
    const { state: rested } = resolveEngineRequest(state, { kind: 'long_rest' });
    expect(rested.party[0].hp).toBe(rested.party[0].maxHp);
    expect(rested.party[0].hitDice!.remaining).toBe(1);
  });
});

describe('small-party scaling (opt-in)', () => {
  it('trims two worgs to one for a solo level-2 hero, but keeps a fair pair of goblins', async () => {
    const { scaleEncounterForParty } = await import('@/lib/engine/balancer');
    const worgs = [monster('worg-a'), monster('worg-b')];
    expect(scaleEncounterForParty(worgs, 2, 1)).toHaveLength(1);
    expect(scaleEncounterForParty(worgs, 2, 4)).toHaveLength(2);
    const gobs = [monster('goblin-a', 'goblin'), monster('goblin-b', 'goblin')];
    expect(scaleEncounterForParty(gobs, 2, 1)).toHaveLength(2);
  });
});
