import type { Adventure, AdventureScene } from './types';
import type { AdventureModuleFile } from './module-schema';
import { ENDING_SCENE_ID } from './types';

export function moduleFileToAdventure(
  module: AdventureModuleFile,
  source: 'private' | 'template',
): Adventure {
  const scenes: Record<string, AdventureScene> = {};
  for (const [id, scene] of Object.entries(module.scenes)) {
    scenes[id] = { ...scene };
  }

  const monsters = module.monsters.map((m) => ({
    ...m,
    hp: m.hp ?? m.maxHp,
    conditions: [],
  }));

  return {
    id: module.id,
    title: module.title,
    tagline: module.tagline,
    estimatedMinutes: module.estimatedMinutes,
    tone: module.tone,
    recommendedCharacters: module.recommendedCharacters,
    source,
    levelRange: module.levelRange,
    campaignGuide: module.campaignGuide,
    playConfig: {
      defaultLevel: module.playConfig?.defaultLevel ?? module.levelRange?.[0] ?? 3,
      partySize: module.playConfig?.partySize ?? 1,
      defaultDifficulty: module.playConfig?.defaultDifficulty ?? 'medium',
      spawnMonstersOnCombatOnly: module.playConfig?.spawnMonstersOnCombatOnly ?? false,
      preferredMonsterTemplates: module.playConfig?.preferredMonsterTemplates ?? [
        'goblin',
        'orc',
        'hobgoblin',
      ],
    },
    sceneEncounters: module.sceneEncounters,
    sceneOrder: module.sceneOrder,
    scenes,
    endingMessage: module.endingMessage,
    npcs: structuredClone(module.npcs),
    monsters,
    mock: module.mock,
  };
}

export function endingSceneStub(): AdventureScene {
  return {
    kind: 'social',
    goal: 'Conclude the adventure.',
    starter: '',
    choices: ['Start a new adventure'],
    guidance: 'Epilogue only.',
    allowedNpcs: [],
    allowedMonsters: [],
    allowedExits: [],
    forbidden: [],
    successConditions: [],
  };
}

export function adventureHasEnding(adventure: Adventure): boolean {
  return adventure.sceneOrder.includes(ENDING_SCENE_ID);
}
