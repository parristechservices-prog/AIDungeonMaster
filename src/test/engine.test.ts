import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState } from '@/lib/game/state';
import { resolveEngineRequest, setRandomProvider, resetRandomProvider } from '@/lib/engine';
import { createExplorationState, type AreaGraph } from '@/lib/engine/spatial';

/** Scripted random provider: each call returns the next value (then repeats). */
function seq(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('engine', () => {
  afterEach(() => resetRandomProvider());

  it('resolves skill checks with valid shape', () => {
    const state = createInitialState('t1');
    const out = resolveEngineRequest(state, { kind: 'skill_check', characterId: state.player.id, skill: 'history', dc: 10, reason: 'Recall lore' });
    expect(typeof out.result.ok).toBe('boolean');
    expect(out.result.breakdown?.formula).toBe('1d20');
  });

  it('starts combat with initiative order', () => {
    const state = createInitialState('t2');
    const out = resolveEngineRequest(state, { kind: 'start_combat' });
    expect(out.state.combat.active).toBe(true);
    expect(out.state.combat.initiative.length).toBe(3);
  });

  it('handles spell slots correctly', () => {
    const state = createInitialState('t3', { characterId: 'wizard' });
    state.player.spellSlots = { 1: { max: 2, remaining: 1 } };
    
    // Cast spell level 1
    const out1 = resolveEngineRequest(state, { kind: 'cast_spell', characterId: state.player.id, spellName: 'Magic Missile', level: 1 });
    expect(out1.result.ok).toBe(true);
    expect(out1.state.player.spellSlots[1].remaining).toBe(0);

    // Try to cast again with no slots
    const out2 = resolveEngineRequest(out1.state, { kind: 'cast_spell', characterId: state.player.id, spellName: 'Magic Missile', level: 1 });
    expect(out2.result.ok).toBe(false);
    expect(out2.result.summary).toContain('No level 1 spell slots remaining');
  });

  it('rejects unknown or unlearned spells without consuming a slot', () => {
    const state = createInitialState('spell-reject', { characterId: 'wizard' });
    const before = state.player.spellSlots[1].remaining;
    const unknown = resolveEngineRequest(state, {
      kind: 'cast_spell',
      characterId: state.player.id,
      spellName: 'Fireball',
      level: 1,
    });
    expect(unknown.result.ok).toBe(false);
    expect(unknown.state.player.spellSlots[1].remaining).toBe(before);

    const unlearned = resolveEngineRequest(state, {
      kind: 'cast_spell',
      characterId: state.player.id,
      spellName: 'Cure Wounds',
      level: 1,
    });
    expect(unlearned.result.ok).toBe(false);
    expect(unlearned.result.summary).toContain('does not know');
  });

  it('rejects invalid manual rolls, inventory changes, NPCs, and condition targets', () => {
    const state = createInitialState('invalid-engine-actions');
    expect(resolveEngineRequest(state, {
      kind: 'skill_check',
      characterId: state.player.id,
      skill: 'history',
      dc: 10,
      reason: 'Recall lore',
      manualRoll: 21,
    }).result.ok).toBe(false);
    expect(resolveEngineRequest(state, {
      kind: 'update_inventory',
      characterId: state.player.id,
      remove: ['Royal Crown'],
    }).result.ok).toBe(false);
    expect(resolveEngineRequest(state, {
      kind: 'update_inventory',
      characterId: state.player.id,
      goldDelta: -(state.player.gold + 1),
    }).result.ok).toBe(false);
    expect(resolveEngineRequest(state, { kind: 'update_npc', npcId: 'missing' }).result.ok).toBe(false);
    expect(resolveEngineRequest(state, {
      kind: 'apply_condition',
      targetId: 'missing',
      condition: 'prone',
    }).result.ok).toBe(false);
  });

  it('uses the character weapon damage on a normal hit, not a flat 1d8', () => {
    const state = createInitialState('atk-weapon');
    state.monsters = [{ id: 'goblin-1', name: 'Goblin', ac: 13, maxHp: 7, hp: 7, attackBonus: 4, damage: '1d6+2', conditions: [] }];
    // d20=15 (hit, not crit), then max d8.
    setRandomProvider(seq([0.7, 0.99]));
    const out = resolveEngineRequest(state, { kind: 'player_attack', characterId: state.player.id, targetId: 'goblin-1' });
    expect(out.result.ok).toBe(true);
    // Fighter wields a Longsword (1d8+3): the breakdown formula proves weapon damage is used.
    expect(out.result.breakdown?.formula).toBe('1d8+3');
  });

  it('doubles the weapon dice on a critical hit', () => {
    const state = createInitialState('atk-crit');
    state.monsters = [{ id: 'goblin-1', name: 'Goblin', ac: 13, maxHp: 7, hp: 7, attackBonus: 4, damage: '1d6+2', conditions: [] }];
    // d20=20 (crit), then dice rolls for damage.
    setRandomProvider(seq([0.99, 0.99, 0.99]));
    const out = resolveEngineRequest(state, { kind: 'player_attack', characterId: state.player.id, targetId: 'goblin-1' });
    expect(out.result.critical).toBe(true);
    expect(out.result.breakdown?.formula).toBe('2d8+3');
  });

  it('uses the monster damage dice on its turn, not a flat 1d6', () => {
    const state = createInitialState('mon-dmg');
    state.combat = { active: true, initiative: [], turnIndex: 0 };
    state.monsters = [{ id: 'wolf-1', name: 'Wolf', ac: 13, maxHp: 11, hp: 11, attackBonus: 4, damage: '2d4+2', conditions: [] }];
    // First value picks the (only) conscious target, then d20=20 (hit), then two d4 rolls.
    setRandomProvider(seq([0, 0.99, 0.5, 0.5]));
    const out = resolveEngineRequest(state, { kind: 'monster_turn' });
    expect(out.result.ok).toBe(true);
    expect(out.result.breakdown?.formula).toBe('2d4+2');
  });

  it('activates combat when a player attacks a living enemy out of combat', () => {
    const state = createInitialState('atk-autostart');
    state.combat = { active: false, initiative: [], turnIndex: 0 };
    state.monsters = [
      { id: 'goblin-1', name: 'Goblin', ac: 13, maxHp: 7, hp: 7, attackBonus: 4, damage: '1d6+2', conditions: [] },
      { id: 'bandit-1', name: 'Bandit', ac: 12, maxHp: 11, hp: 11, attackBonus: 3, damage: '1d6+1', conditions: [] },
    ];
    setRandomProvider(seq([0.99, 0.5, 0.99, 0.5, 0.5, 0.5, 0.5]));
    const out = resolveEngineRequest(state, { kind: 'player_attack', characterId: state.player.id, targetId: 'goblin-1' });
    expect(out.state.combat.active).toBe(true);
    expect(out.state.combat.initiative.length).toBe(3); // 1 PC + 2 monsters
  });

  it('does not crit on a natural 20 that was discarded by disadvantage', () => {
    const state = createInitialState('atk-disadv');
    state.monsters = [{ id: 'goblin-1', name: 'Goblin', ac: 13, maxHp: 7, hp: 7, attackBonus: 4, damage: '1d6+2', conditions: [] }];
    // Disadvantage rolls two d20s: 20 (discarded) then 2 (kept). Kept roll must not crit.
    setRandomProvider(seq([0.99, 0.05]));
    const out = resolveEngineRequest(state, {
      kind: 'player_attack', characterId: state.player.id, targetId: 'goblin-1', disadvantage: true,
    });
    expect(out.result.critical).not.toBe(true);
    expect(out.result.ok).toBe(false); // kept roll 2 + 5 = 7 vs AC 13
  });

  it('a monster hitting a downed character causes death-save failures, not HP loss', () => {
    const state = createInitialState('downed');
    state.party[0] = { ...state.party[0], hp: 0, unconscious: true, deathSaves: { success: 0, failure: 0 } };
    state.player = state.party[0];
    state.monsters = [{ id: 'goblin-1', name: 'Goblin', ac: 13, maxHp: 7, hp: 7, attackBonus: 4, damage: '1d6+2', conditions: [] }];
    setRandomProvider(seq([0.99, 0.5, 0.5])); // hit
    const out = resolveEngineRequest(state, { kind: 'monster_turn' });
    expect(out.result.ok).toBe(true);
    expect(out.state.party[0].deathSaves.failure).toBe(2);
    expect(out.state.party[0].hp).toBe(0);
  });

  it('a third death-save failure kills the downed character', () => {
    const state = createInitialState('dying');
    state.party[0] = { ...state.party[0], hp: 0, unconscious: true, deathSaves: { success: 0, failure: 2 } };
    state.player = state.party[0];
    state.monsters = [{ id: 'goblin-1', name: 'Goblin', ac: 13, maxHp: 7, hp: 7, attackBonus: 4, damage: '1d6+2', conditions: [] }];
    setRandomProvider(seq([0.99, 0.5, 0.5]));
    const out = resolveEngineRequest(state, { kind: 'monster_turn' });
    expect(out.state.party[0].deathSaves.failure).toBe(3);
  });

  it('restores resources on long rest', () => {
    const state = createInitialState('t4');
    state.player.hp = 10;
    state.player.spellSlots = { 1: { max: 2, remaining: 0 } };
    state.player.features[0].usesRemaining = 0;

    const out = resolveEngineRequest(state, { kind: 'long_rest' });
    expect(out.state.player.hp).toBe(state.player.maxHp);
    expect(out.state.player.spellSlots[1].remaining).toBe(2);
    expect(out.state.player.features[0].usesRemaining).toBe(state.player.features[0].usesMax);
  });

  it('resolves spatial movement through the engine when an area graph exists', () => {
    const graph: AreaGraph = {
      areas: {
        square: {
          id: 'square',
          name: 'Town Square',
          connections: [{ to: 'inn', difficulty: 'normal', label: 'the lantern-lit lane' }],
        },
        inn: {
          id: 'inn',
          name: 'Wayside Inn',
          connections: [{ to: 'square', difficulty: 'normal' }],
        },
      },
    };
    const state = createInitialState('spatial-engine');
    state.exploration = createExplorationState(graph, { [state.player.id]: 'square' });

    const moved = resolveEngineRequest(state, {
      kind: 'move_area',
      actorId: state.player.id,
      targetAreaId: 'inn',
    });
    expect(moved.result.ok).toBe(true);
    expect(moved.result.spatial).toMatchObject({ kind: 'move_area', ok: true, from: 'square', to: 'inn' });
    expect(moved.state.exploration?.locations[state.player.id]).toBe('inn');

    const invalid = resolveEngineRequest(moved.state, {
      kind: 'move_area',
      actorId: state.player.id,
      targetAreaId: 'missing',
    });
    expect(invalid.result.ok).toBe(false);
    expect(invalid.state.exploration?.locations[state.player.id]).toBe('inn');
  });
});
