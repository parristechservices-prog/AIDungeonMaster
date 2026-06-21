import { describe, expect, it } from 'vitest';
import { createInitialState, migrateGameState } from '@/lib/game/state';
import { resolveEngineRequest } from '@/lib/engine';
import type { GameState } from '@/lib/game/types';

describe('exploration state wiring', () => {
  it('seeds exploration state for an adventure with an authored area graph', () => {
    const state = createInitialState('sess-1', { adventureId: 'skt-nightstone-starter' });
    expect(state.exploration).toBeDefined();
    const activeId = state.activeCharacterId;
    expect(state.exploration!.locations[activeId]).toBe('gatehouse');
  });

  it('leaves exploration undefined for adventures without a graph', () => {
    const state = createInitialState('sess-2', { adventureId: 'brindlehook-inn' });
    expect(state.exploration).toBeUndefined();
  });

  it('backfills exploration on migrate for an old save missing it', () => {
    const state = createInitialState('sess-3', { adventureId: 'skt-nightstone-starter' });
    const legacy = { ...state, exploration: undefined } as GameState;
    const migrated = migrateGameState(legacy);
    expect(migrated.exploration).toBeDefined();
    expect(migrated.exploration!.locations[migrated.activeCharacterId]).toBe('gatehouse');
  });

  it('round-trips a move_area request through the engine', () => {
    const state = createInitialState('sess-4', { adventureId: 'skt-nightstone-starter' });
    const activeId = state.activeCharacterId;
    const { state: next, result } = resolveEngineRequest(state, {
      kind: 'move_area',
      actorId: activeId,
      targetAreaId: 'drawbridge',
    });
    expect(result.ok).toBe(true);
    expect(result.spatial?.kind).toBe('move_area');
    expect(next.exploration!.locations[activeId]).toBe('drawbridge');
    // original state is untouched (engine is immutable)
    expect(state.exploration!.locations[activeId]).toBe('gatehouse');
  });

  it('keeps a gated connection locked when the party lacks the key', () => {
    const base = createInitialState('sess-6', { adventureId: 'skt-nightstone-starter' });
    const activeId = base.activeCharacterId;
    // Stand the party at the keep gate, holding no key.
    const state: GameState = {
      ...base,
      exploration: { ...base.exploration!, locations: { ...base.exploration!.locations, [activeId]: 'keep_gate' } },
    };
    const { result } = resolveEngineRequest(state, {
      kind: 'move_area',
      actorId: activeId,
      targetAreaId: 'keep_courtyard',
    });
    expect(result.ok).toBe(false);
    expect(result.spatial).toMatchObject({ kind: 'move_area', ok: false, reason: 'requires_unmet' });
  });

  it('unlocks a gated connection when an inventory key satisfies the tag', () => {
    const base = createInitialState('sess-7', { adventureId: 'skt-nightstone-starter' });
    const activeId = base.activeCharacterId;
    const party = base.party.map((p, i) =>
      i === 0 ? { ...p, inventory: [...p.inventory, 'Nandar Keep Gate Key'] } : p,
    );
    const state: GameState = {
      ...base,
      party,
      player: party[0],
      exploration: { ...base.exploration!, locations: { ...base.exploration!.locations, [activeId]: 'keep_gate' } },
    };
    const { state: next, result } = resolveEngineRequest(state, {
      kind: 'move_area',
      actorId: activeId,
      targetAreaId: 'keep_courtyard',
    });
    expect(result.ok).toBe(true);
    expect(next.exploration!.locations[activeId]).toBe('keep_courtyard');
  });

  it('rejects an illegal move_area to a non-connected area', () => {
    const state = createInitialState('sess-5', { adventureId: 'skt-nightstone-starter' });
    const activeId = state.activeCharacterId;
    const { state: next, result } = resolveEngineRequest(state, {
      kind: 'move_area',
      actorId: activeId,
      targetAreaId: 'great_hall',
    });
    expect(result.ok).toBe(false);
    expect(next.exploration!.locations[activeId]).toBe('gatehouse');
  });
});
