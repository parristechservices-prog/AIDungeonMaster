import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '@/lib/game/state';
import { missingInventoryItems, removeInventoryItems } from '@/lib/game/inventory';
import { validateDmTurn } from '@/lib/orchestrator/validate-dm-turn';
import { validateNarrationAgainstResults, validateNarrationAgainstState } from '@/lib/llm/validate-narration';
import { createSessionId, isSecureSessionId } from '@/lib/security/session-id';
import {
  issueSessionAccess,
  isSessionAuthorized,
  SESSION_ACCESS_COOKIE,
} from '@/lib/security/session-access';
import {
  callLlm,
  createLlmAttemptBudget,
  withLlmAttemptBudget,
} from '@/lib/llm/provider';
import type { DmTurn } from '@/lib/llm/contracts';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe('session ownership', () => {
  it('uses full-entropy session ids instead of the old eight-hex form', () => {
    expect(isSecureSessionId(createSessionId())).toBe(true);
    expect(isSecureSessionId('sess-deadbeef')).toBe(false);
    expect(isSecureSessionId('local-default')).toBe(false);
  });

  it('authorizes only the httpOnly bearer token whose hash is stored in state', () => {
    process.env.PARTYQUEST_REQUIRE_SESSION_ACCESS = 'true';
    const sessionId = createSessionId();
    const access = issueSessionAccess(sessionId);
    const state = { ...createInitialState(sessionId), sessionAccessHash: access.hash };
    const good = new Request('https://partyquest.example/api/session', {
      headers: { cookie: `${SESSION_ACCESS_COOKIE}=${access.cookieValue}` },
    });
    const bad = new Request('https://partyquest.example/api/session', {
      headers: { cookie: `${SESSION_ACCESS_COOKIE}=${sessionId}.wrong-token` },
    });
    expect(isSessionAuthorized(good, state)).toBe(true);
    expect(isSessionAuthorized(bad, state)).toBe(false);
  });
});

describe('inventory quantity authority', () => {
  it('treats duplicate removals as quantities, not repeated includes checks', () => {
    expect(missingInventoryItems(['Wine bottle'], ['Wine bottle', 'Wine bottle'])).toEqual(['Wine bottle']);
    expect(missingInventoryItems(['Wine bottle', 'Wine bottle'], ['Wine bottle', 'Wine bottle'])).toEqual([]);
    expect(removeInventoryItems(['Wine bottle', 'Rope', 'Wine bottle'], ['Wine bottle', 'Wine bottle'])).toEqual(['Rope']);
  });
});

describe('DM world authority', () => {
  it('rejects a completed purchase narrated without an inventory engine request', () => {
    const state = createInitialState('authority-purchase');
    const turn: DmTurn = {
      engineRequests: [],
      narration: 'You bought the finest wine and paid the innkeeper five gold.',
      needsResultBeforeNarrating: false,
    };
    const validation = validateDmTurn(turn, state);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((error) => error.code === 'untracked_transaction')).toBe(true);
  });

  it('requires update_inventory to wait for the engine before narration resolves it', () => {
    const state = createInitialState('authority-inventory');
    const characterId = state.party[0].id;
    const turn: DmTurn = {
      engineRequests: [{ kind: 'update_inventory', characterId, add: ['Wine bottle'], goldDelta: -5 }],
      narration: 'You reach for your coin while the innkeeper sets a bottle on the counter.',
      needsResultBeforeNarrating: false,
    };
    const validation = validateDmTurn(turn, state);
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((error) => error.code === 'missing_needs_result')).toBe(true);
  });

  it('rejects an invented family relationship with a known NPC', () => {
    const state = createInitialState('authority-relationship');
    const npc = state.npcs[0];
    expect(npc).toBeTruthy();
    const turn: DmTurn = {
      engineRequests: [],
      narration: `Your wife ${npc.name} smiles as you enter.`,
      needsResultBeforeNarrating: false,
    };
    const validation = validateDmTurn(turn, state);
    expect(validation.errors.some((error) => error.code === 'unestablished_relationship')).toBe(true);
  });

  it('allows a relationship only when canon in the same turn establishes it', () => {
    const state = createInitialState('authority-canon');
    const npc = state.npcs[0];
    const turn: DmTurn = {
      engineRequests: [{ kind: 'add_canon_fact', content: `${npc.name} is the hero's wife.`, importance: 'high' }],
      narration: `Your wife ${npc.name} greets you.`,
      needsResultBeforeNarrating: false,
    };
    expect(validateDmTurn(turn, state).ok).toBe(true);
  });

  it('post-narration checks catch free transactions, fake gold balances, and invented relationships', () => {
    const state = createInitialState('authority-narration');
    const npc = state.npcs[0];
    const active = state.party.find((member) => member.id === state.activeCharacterId)!;
    const narration = `Your wife ${npc.name} hands you the wine. You bought it and paid five gold. You have ${active.gold + 99} gold.`;
    const stateWarnings = validateNarrationAgainstState(narration, state);
    const resultWarnings = validateNarrationAgainstResults(narration, [], state);
    expect(stateWarnings.some((warning) => warning.includes('relationship') || warning.includes('Canon'))).toBe(true);
    expect(stateWarnings.some((warning) => warning.includes('engine has'))).toBe(true);
    expect(resultWarnings.some((warning) => warning.includes('transaction'))).toBe(true);
  });
});

describe('provider work budget', () => {
  it('bounds actual provider HTTP attempts across key failover', async () => {
    process.env.PARTYQUEST_FORCE_MOCK = 'false';
    process.env.PARTYQUEST_LLM_PROVIDER = 'groq';
    process.env.GROQ_API_KEYS = 'key-one,key-two,key-three,key-four';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('no', { status: 503 }));
    const budget = createLlmAttemptBudget(2);
    const result = await withLlmAttemptBudget(budget, () => callLlm({ systemPrompt: 'system', playerInput: 'input' }));
    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(budget.used).toBe(2);
  });
});
