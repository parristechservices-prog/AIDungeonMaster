import { beforeEach, describe, expect, it } from 'vitest';
import { buildExplorationMapView, resolveMapMode } from '@/lib/play/map-view';
import { createInitialState, buildBattleMap } from '@/lib/game/state';
import { resetServerAdventureRegistry } from '@/lib/game/adventures/registry.server';
import type { GameState } from '@/lib/game/types';
import type { TurnResponse } from '@/lib/play/types';

// GameState is structurally compatible with the trimmed TurnResponse state for
// the fields the map-view reads.
const asPlay = (s: GameState) => s as unknown as NonNullable<TurnResponse['state']>;

describe('resolveMapMode', () => {
  beforeEach(() => resetServerAdventureRegistry());

  it('returns exploration for a Nightstone scene out of combat', () => {
    const state = createInitialState('map-explore', { adventureId: 'skt-nightstone-chapter1', characterIds: ['fighter'] });
    expect(resolveMapMode(asPlay(state))).toBe('exploration');
  });

  it('returns combat (priority) when a battle map is active', () => {
    const base = createInitialState('map-combat', { adventureId: 'skt-nightstone-chapter1', characterIds: ['fighter'] });
    const combat: GameState = {
      ...base,
      monsters: [{ id: 'gob', name: 'Goblin', ac: 12, maxHp: 7, hp: 7, attackBonus: 4, damage: '1d6', conditions: [] }],
      combat: { active: true, initiative: [{ actorId: base.activeCharacterId, roll: 12 }], turnIndex: 0 },
    };
    const withMap = { ...combat, combat: { ...combat.combat, battleMap: buildBattleMap(combat) } };
    expect(resolveMapMode(asPlay(withMap))).toBe('combat');
  });

  it('returns empty for an adventure with no exploration graph and no combat', () => {
    // We use a dummy ID that doesn't have an area graph registered
    const state = createInitialState('map-empty', { adventureId: 'some-adventure-without-map', characterIds: ['fighter'] });
    expect(resolveMapMode(asPlay(state))).toBe('empty');
  });
});

describe('buildExplorationMapView (Nightstone)', () => {
  beforeEach(() => resetServerAdventureRegistry());

  function nightstone() {
    return asPlay(createInitialState('map-view-skt', { adventureId: 'skt-nightstone-chapter1', characterIds: ['fighter'] }));
  }

  it('shows the current area with name and exits', () => {
    const view = buildExplorationMapView(nightstone());
    expect(view).not.toBeNull();
    expect(view!.mode).toBe('exploration');
    expect(view!.currentAreaName.toLowerCase()).toContain('gatehouse');
    expect(view!.exits.length).toBeGreaterThan(0);
  });

  it('gives each exit a "Move to <name>" suggestion and distance/difficulty', () => {
    const view = buildExplorationMapView(nightstone())!;
    const drawbridge = view.exits.find((e) => e.name.toLowerCase().includes('drawbridge'));
    expect(drawbridge).toBeDefined();
    expect(drawbridge!.command).toBe(`Move to ${drawbridge!.name}`);
    expect(drawbridge!.difficulty).toBeTruthy();
  });

  it('marks a gated exit as locked (needs a key/condition)', () => {
    // Stand the party at the keep gate, which has a key-gated connection.
    const base = createInitialState('map-view-locked', { adventureId: 'skt-nightstone-chapter1', characterIds: ['fighter'] });
    const atGate: GameState = {
      ...base,
      exploration: { ...base.exploration!, locations: { ...base.exploration!.locations, [base.activeCharacterId]: 'keep_gate' } },
    };
    const view = buildExplorationMapView(asPlay(atGate))!;
    expect(view.exits.some((e) => e.locked)).toBe(true);
  });

  it('lists scene NPCs as tappable talk suggestions, no hidden monsters', () => {
    const view = buildExplorationMapView(nightstone())!;
    for (const a of view.actorsPresent) {
      expect(a.command).toMatch(/^Talk to /);
      expect(a.kind === 'party' || a.kind === 'npc').toBe(true);
    }
  });

  it('returns null when no current area resolves', () => {
    const base = createInitialState('map-view-none', { adventureId: 'skt-nightstone-chapter1', characterIds: ['fighter'] });
    const lost = { ...base, exploration: { ...base.exploration!, locations: {} } };
    expect(buildExplorationMapView(asPlay(lost))).toBeNull();
  });
});
