import { describe, expect, it, beforeEach } from 'vitest';
import {
  getAdventure,
  listAdventuresForCatalog,
  resetServerAdventureRegistry,
} from '@/lib/game/adventures/registry.server';
import { createInitialState } from '@/lib/game/state';

describe('adventure registry', () => {
  beforeEach(() => {
    resetServerAdventureRegistry();
  });

  it('includes built-in and template adventures', () => {
    const catalog = listAdventuresForCatalog();
    expect(catalog.some((a) => a.id === 'brindlehook-inn' && a.source === 'builtin')).toBe(true);
    expect(catalog.some((a) => a.id === 'example-frontier' && a.source === 'template')).toBe(true);
  });

  it('loads template module scene order', () => {
    const adventure = getAdventure('example-frontier');
    expect(adventure.sceneOrder[0]).toBe('village-social');
    expect(adventure.scenes['village-social'].kind).toBe('social');
  });

  it('starts new games on the first scene in sceneOrder', () => {
    const state = createInitialState('mod-1', { adventureId: 'example-frontier', characterId: 'fighter' });
    expect(state.sceneId).toBe('village-social');
    expect(state.monsters).toHaveLength(2);
  });
});
