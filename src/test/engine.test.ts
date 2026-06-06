import { describe, expect, it } from 'vitest';
import { createInitialState } from '@/lib/game/state';
import { resolveEngineRequest } from '@/lib/engine';

describe('engine', () => {
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
});
