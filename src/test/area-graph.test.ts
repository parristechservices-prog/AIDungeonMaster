import { describe, expect, it } from 'vitest';
import { AreaGraph } from '@/lib/engine/spatial/types';
import { actorsInSameArea, canMove, createExplorationState, findPath, moveActor } from '@/lib/engine/spatial/area-graph';

function sampleGraph(): AreaGraph {
  return {
    areas: {
      inn: {
        id: 'inn',
        name: 'Brindlehook Inn',
        connections: [{ to: 'market', difficulty: 'normal', label: 'the front door' }],
      },
      market: {
        id: 'market',
        name: 'Market Square',
        connections: [
          { to: 'inn', difficulty: 'normal' },
          { to: 'temple', difficulty: 'normal' },
          { to: 'vault', difficulty: 'blocked', label: 'a collapsed tunnel' },
        ],
      },
      temple: {
        id: 'temple',
        name: 'Temple of Light',
        connections: [
          { to: 'market', difficulty: 'normal' },
          {
            to: 'crypt',
            difficulty: 'hazardous',
            label: 'a locked iron gate',
            requires: { tag: 'key:crypt_gate' },
          },
        ],
      },
      crypt: {
        id: 'crypt',
        name: 'Crypt of Whispers',
        connections: [{ to: 'temple', difficulty: 'hazardous' }],
      },
      vault: {
        id: 'vault',
        name: 'Sealed Vault',
        connections: [],
      },
    },
  };
}

describe('area graph movement', () => {
  it('allows movement along an unblocked connection', () => {
    const state = createExplorationState(sampleGraph(), { fighter: 'inn' });
    expect(canMove(state, 'fighter', 'market').ok).toBe(true);
  });

  it('rejects movement to an area with no direct connection', () => {
    const state = createExplorationState(sampleGraph(), { fighter: 'inn' });
    expect(canMove(state, 'fighter', 'temple')).toEqual({ ok: false, reason: 'no_connection' });
  });

  it('rejects movement through blocked or unmet gated connections', () => {
    const blocked = createExplorationState(sampleGraph(), { fighter: 'market' });
    expect(canMove(blocked, 'fighter', 'vault')).toEqual({ ok: false, reason: 'blocked' });

    const gated = createExplorationState(sampleGraph(), { fighter: 'temple' });
    expect(canMove(gated, 'fighter', 'crypt')).toEqual({
      ok: false,
      reason: 'requires_unmet',
      requiredTag: 'key:crypt_gate',
    });
    expect(canMove(gated, 'fighter', 'crypt', new Set(['key:crypt_gate'])).ok).toBe(true);
  });

  it('returns copied state for successful moves and unchanged state for failed moves', () => {
    const state = createExplorationState(sampleGraph(), { fighter: 'inn' });
    const moved = moveActor(state, 'fighter', 'market');
    expect(state.locations.fighter).toBe('inn');
    expect(moved.state.locations.fighter).toBe('market');

    const failed = moveActor(state, 'fighter', 'temple');
    expect(failed.result.ok).toBe(false);
    expect(failed.state.locations.fighter).toBe('inn');
  });

  it('finds actors sharing an area, excluding self', () => {
    const state = createExplorationState(sampleGraph(), {
      fighter: 'market',
      guide: 'market',
      guard: 'temple',
    });
    expect(actorsInSameArea(state, 'fighter')).toEqual(['guide']);
  });

  it('finds multi-step paths and respects gating when asked', () => {
    const state = createExplorationState(sampleGraph());
    expect(findPath(state, 'inn', 'crypt')).toEqual(['inn', 'market', 'temple', 'crypt']);
    expect(findPath(state, 'inn', 'crypt', new Set(), true)).toBeNull();
    expect(findPath(state, 'inn', 'crypt', new Set(['key:crypt_gate']), true)).toEqual(['inn', 'market', 'temple', 'crypt']);
    expect(findPath(state, 'market', 'vault')).toBeNull();
    expect(findPath(state, 'market', 'market')).toEqual(['market']);
  });
});
