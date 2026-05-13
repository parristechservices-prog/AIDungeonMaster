import { pregenFighter } from './pregens';
import { buildCombatMonsters } from './monsters';
import type { GameState, SceneId } from './types';

export function createInitialState(sessionId: string): GameState {
  return {
    sessionId,
    sceneId: 'social',
    log: [],
    canonLog: [],
    player: structuredClone(pregenFighter),
    monsters: buildCombatMonsters(),
    npcs: [
      {
        id: 'npc-mira',
        name: 'Mira',
        description: 'The sharp-eyed innkeeper of Brindlehook Inn. She sees everything that happens on the docks.',
        disposition: 'neutral',
        knowledge: ['The courier was last seen heading toward the old boathouse.', 'Two men in dark cloaks were following him.'],
      }
    ],
    combat: { active: false, initiative: [], turnIndex: 0 },
  };
}

export function advanceScene(state: GameState): GameState {
  const order: SceneId[] = ['social', 'exploration', 'combat', 'ending'];
  const i = order.indexOf(state.sceneId);
  if (i < 0 || i === order.length - 1) return state;
  return { ...state, sceneId: order[i + 1] };
}
