import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, advanceScene } from '@/lib/game/state';
import { getSceneKind } from '@/lib/game/adventures/helpers';
import { getAdventure, resetServerAdventureRegistry } from '@/lib/game/adventures/registry.server';

describe('SKT encounter spawning', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetServerAdventureRegistry();
  });

  it('starts with no monsters when spawnMonstersOnCombatOnly', () => {
    const state = createInitialState('enc-1', {
      adventureId: 'skt-nightstone-starter',
      characterId: 'fighter',
    });
    expect(state.monsters).toHaveLength(0);
  });

  it('spawns monsters when advancing to the first combat scene', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    let state = createInitialState('enc-2', {
      adventureId: 'skt-nightstone-starter',
      characterId: 'fighter',
    });
    const adventure = getAdventure('skt-nightstone-starter');

    while (getSceneKind(adventure, state.sceneId) !== 'combat') {
      state = advanceScene(state);
    }
    expect(state.sceneId).toBe('ear-seekers');
    expect(state.monsters.length).toBeGreaterThan(0);
    expect(state.monsters.some((m) => m.name.toLowerCase().includes('orc'))).toBe(true);
  });
});
