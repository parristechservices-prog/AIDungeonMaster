// Deterministic "AI Director" consistency harness. Feeds representative
// structured AI-style outputs through the SAME schema + validators the live
// pipeline uses — no live model, no API keys. Proves the engine/validators
// catch the ways an LLM can go wrong: malformed requests, invented movement,
// invented hits, and engine-vs-prose drift.

import { describe, expect, it } from 'vitest';
import { dmTurnSchema } from '@/lib/llm/contracts';
import { validateNarrationAgainstResults, validateNarrationAgainstState } from '@/lib/llm/validate-narration';
import { createInitialState } from '@/lib/game/state';

describe('AI turn contract — schema accepts valid, repairs and rejects invalid', () => {
  it('accepts a valid spatial query request', () => {
    const parsed = dmTurnSchema.safeParse({
      engineRequests: [{ kind: 'query_path_exists', fromAreaId: 'gatehouse', toAreaId: 'drawbridge' }],
      narration: 'You study the route ahead.',
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.engineRequests).toHaveLength(1);
  });

  it('accepts a valid tactical attack and repairs type->kind', () => {
    const parsed = dmTurnSchema.safeParse({
      engineRequests: [{ type: 'player_attack', characterId: 'pc', targetId: 'gob', ranged: true }],
      narration: 'You loose an arrow.',
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.engineRequests[0].kind).toBe('player_attack');
  });

  it('drops a malformed engine request instead of failing the whole turn', () => {
    const parsed = dmTurnSchema.safeParse({
      engineRequests: [
        { kind: 'not_a_real_kind', foo: 1 },
        { kind: 'monster_turn' },
      ],
      narration: 'The fight continues.',
    });
    expect(parsed.success).toBe(true);
    const kinds = parsed.success ? parsed.data.engineRequests.map((r) => r.kind) : [];
    expect(kinds).toEqual(['monster_turn']); // malformed one dropped
  });

  it('caps engine requests at the per-turn maximum', () => {
    const parsed = dmTurnSchema.safeParse({
      engineRequests: Array.from({ length: 9 }, () => ({ kind: 'monster_turn' })),
      narration: 'Chaos.',
    });
    expect(parsed.success && parsed.data.engineRequests.length).toBeLessThanOrEqual(5);
  });
});

describe('AI cannot invent movement / arrival', () => {
  it('warns when narration claims arrival but no successful move_area happened', () => {
    const warnings = validateNarrationAgainstResults('You cross the bridge and arrive inside the keep.', [
      { kind: 'query_exits', summary: 'exits', ok: true },
    ]);
    expect(warnings.join(' ')).toMatch(/movement or arrival/i);
  });

  it('warns when narration claims arrival but the move_area failed', () => {
    const warnings = validateNarrationAgainstResults('You step into the vault at last.', [
      { kind: 'move_area', summary: 'blocked', ok: false, spatial: { kind: 'move_area', ok: false, reason: 'blocked' } },
    ]);
    expect(warnings.join(' ')).toMatch(/movement or arrival/i);
  });
});

describe('AI cannot invent combat outcomes', () => {
  it('warns when prose claims success but the engine result failed', () => {
    const warnings = validateNarrationAgainstResults('Your blade hits and the goblin falls.', [
      { kind: 'player_attack', summary: 'missed', ok: false },
    ]);
    expect(warnings.join(' ')).toMatch(/success but the engine result failed/i);
  });

  it('warns when prose implies a monster acts at 0 HP', () => {
    const state = createInitialState('ai-harness', { adventureId: 'brindlehook-inn' });
    const withDead = {
      ...state,
      monsters: [{ id: 'gob', name: 'Goblin', ac: 12, maxHp: 7, hp: 0, attackBonus: 4, damage: '1d6', conditions: [] }],
    };
    const warnings = validateNarrationAgainstState('The Goblin lunges and attacks you again.', withDead);
    expect(warnings.join(' ')).toMatch(/goblin/i);
  });

  it('warns when narration contradicts the active character HP', () => {
    const state = createInitialState('ai-harness-hp', { adventureId: 'brindlehook-inn' });
    const hero = state.party[0];
    const warnings = validateNarrationAgainstState(`You have ${hero.hp + 99} HP remaining.`, state);
    expect(warnings.join(' ')).toMatch(/hp/i);
  });
});

describe('AI clean turn produces no warnings', () => {
  it('a faithful narration of a successful result is not flagged', () => {
    const warnings = validateNarrationAgainstResults('Your arrow finds its mark for solid damage.', [
      { kind: 'player_attack', summary: 'Hit for 6', ok: true, breakdown: { rolls: [5], total: 6 } },
    ]);
    expect(warnings).toEqual([]);
  });
});
