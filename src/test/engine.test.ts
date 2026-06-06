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
    const state = createInitialState('t3');
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
