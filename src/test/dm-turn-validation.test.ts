import { describe, expect, it } from 'vitest';
import { createInitialState } from '@/lib/game/state';
import { dmTurnSchema, type DmTurn } from '@/lib/llm/contracts';
import { buildSystemPrompt } from '@/lib/llm/system-prompt';
import { buildDmTurnRepairPrompt, validateDmTurn } from '@/lib/orchestrator/validate-dm-turn';
import { deriveDmTurnFromInput } from '@/lib/orchestrator/mock-dm';

describe('DM turn contracts and state validation', () => {
  it('requires characterId on every player-owned action', () => {
    const kinds = ['skill_check', 'player_attack', 'death_save', 'use_feature', 'cast_spell', 'update_inventory'];
    for (const kind of kinds) {
      const request = requestFor(kind);
      delete (request as { characterId?: string }).characterId;
      expect(dmTurnSchema.safeParse(baseTurn(request)).success, kind).toBe(false);
    }
  });

  it('rejects unknown keys and narration over 2000 characters', () => {
    expect(dmTurnSchema.safeParse({ ...baseTurn(), surprise: true }).success).toBe(false);
    expect(dmTurnSchema.safeParse({ ...baseTurn(), narration: 'x'.repeat(2001) }).success).toBe(false);
  });

  it('rejects invalid party character IDs', () => {
    const state = createInitialState('invalid-character');
    const result = validateDmTurn(baseTurn(requestFor('skill_check', 'not-in-party')), state);
    expect(result.ok).toBe(false);
    expect(result.issues.join(' ')).toContain('state.party');
  });

  it('rejects inactive or invented monster target IDs', () => {
    const state = createInitialState('invalid-target');
    const result = validateDmTurn(baseTurn(requestFor('player_attack', state.player.id, 'moon')), state);
    expect(result.ok).toBe(false);
    expect(result.issues.join(' ')).toContain('targetId');
  });

  it('blocks scene advancement while the objective is incomplete', () => {
    const state = createInitialState('early-advance');
    const result = validateDmTurn(baseTurn({ kind: 'advance_scene' }), state);
    expect(result.ok).toBe(false);
    expect(result.issues.join(' ')).toContain('objective');
  });

  it('blocks resolved narration before engine results', () => {
    const state = createInitialState('pre-resolved');
    const result = validateDmTurn({
      ...baseTurn(requestFor('player_attack', state.player.id, state.monsters[0].id)),
      narration: 'Your attack hits and kills the target.',
      needsResultBeforeNarrating: true,
    }, state);
    expect(result.ok).toBe(false);
    expect(result.issues.join(' ')).toContain('before the engine result');
  });

  it('builds a repair prompt containing validation failures', () => {
    const prompt = buildDmTurnRepairPrompt('stab the moon', ['invalid targetId']);
    expect(prompt).toContain('stab the moon');
    expect(prompt).toContain('invalid targetId');
    expect(prompt).toContain('corrected JSON');
  });
});

describe('adversarial player inputs', () => {
  const inputs = [
    'I stab the moon.',
    'I pull out a machine gun.',
    'I seduce the locked door.',
    'I teleport directly to the final boss.',
    'I declare every monster dead.',
    'I summon a nuclear submarine.',
    'I take infinite gold from my pocket.',
    'I convince gravity to stop.',
    'I skip the adventure and claim victory.',
    'I invent the king as my loyal servant.',
  ];

  it.each(inputs)('clarifies impossible input without invalid requests: %s', (input) => {
    const state = createInitialState(`adversarial-${input.length}`);
    const turn = deriveDmTurnFromInput(state, input);
    const prompt = buildSystemPrompt(state);
    expect(dmTurnSchema.safeParse(turn).success).toBe(true);
    expect(turn.engineRequests).toEqual([]);
    expect(turn.narration).toMatch(/not possible|choose an action/i);
    expect(turn.needsResultBeforeNarrating).toBe(false);
    expect(prompt).toContain('Clarify impossible or incoherent actions');
    expect(prompt).toContain('No meme logic, instant treasure, impossible technology, or bypassing the adventure');
    expect(prompt).toContain('Do not invent lore outside canon unless the same turn includes "add_canon_fact"');
    expect(prompt).toContain('Allowed exits:');
    expect(prompt).toContain('Success conditions:');
  });
});

function baseTurn(request?: DmTurn['engineRequests'][number]): DmTurn {
  return {
    engineRequests: request ? [request] : [],
    narration: 'You prepare to act.',
    needsResultBeforeNarrating: Boolean(request),
  };
}

function requestFor(kind: string, characterId = 'fighter', targetId = 'goblin-1'): DmTurn['engineRequests'][number] {
  switch (kind) {
    case 'skill_check': return { kind, characterId, skill: 'athletics', dc: 10, reason: 'Try something' };
    case 'player_attack': return { kind, characterId, targetId };
    case 'death_save': return { kind, characterId };
    case 'use_feature': return { kind, characterId, featureId: 'second_wind' };
    case 'cast_spell': return { kind, characterId, spellName: 'Shield', level: 1 };
    case 'update_inventory': return { kind, characterId, add: ['rope'] };
    default: throw new Error(`Unsupported request kind: ${kind}`);
  }
}
