import { createInitialState } from './src/lib/game/state';
import { getAdventure } from './src/lib/game/adventures/registry.server';

const state = createInitialState('test-sess', { adventureId: 'brindlehook-inn', characterIds: ['fighter'] });
console.log('exploration:', JSON.stringify(state.exploration, null, 2));
console.log('activeCharacterId:', state.activeCharacterId);
console.log('location for active char:', state.exploration?.locations[state.activeCharacterId]);
