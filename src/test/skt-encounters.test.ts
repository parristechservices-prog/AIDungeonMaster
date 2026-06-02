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

  it('spawns the two square worgs when advancing to the first combat scene', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    let state = createInitialState('enc-2', {
      adventureId: 'skt-nightstone-starter',
      characterId: 'fighter',
    });
    const adventure = getAdventure('skt-nightstone-starter');

    while (getSceneKind(adventure, state.sceneId) !== 'combat') {
      state = advanceScene(state);
    }
    expect(state.sceneId).toBe('village-square');
    expect(state.monsters).toHaveLength(2);
    expect(state.monsters.every((m) => m.name.toLowerCase() === 'worg')).toBe(true);
  });
});
