import { buildBalancedEncounter, type Difficulty } from '@/lib/engine/balancer';
import { getMonster } from '@/lib/game/monsters';
import type { Monster } from '@/lib/game/types';
import type { Adventure } from './types';

export type SceneEncounterSpec = {
  difficulty?: Difficulty;
  /** Explicit template ids — spawns one of each */
  templates?: string[];
  /** Build from CR budget using these ids */
  auto?: boolean;
  preferredTemplates?: string[];
};

export function resolveCombatMonsters(
  adventure: Adventure,
  sceneId: string,
  playerLevel: number,
): Monster[] {
  const spec = adventure.sceneEncounters?.[sceneId];
  const partySize = adventure.playConfig?.partySize ?? 1;
  const difficulty = spec?.difficulty ?? adventure.playConfig?.defaultDifficulty ?? 'medium';

  if (spec?.templates?.length) {
    return spec.templates.map((templateId, i) => {
      const m = getMonster(templateId);
      return { ...m, id: `${templateId}-${sceneId}-${i}` };
    });
  }

  if (spec?.auto || !spec) {
    const preferred =
      spec?.preferredTemplates ??
      adventure.playConfig?.preferredMonsterTemplates ??
      ['goblin', 'orc'];
    return buildBalancedEncounter(playerLevel, partySize, difficulty, preferred);
  }

  return adventure.monsters.map((m) => ({ ...m }));
}

export function initialMonstersForAdventure(adventure: Adventure, playerLevel: number): Monster[] {
  if (adventure.playConfig?.spawnMonstersOnCombatOnly) {
    return [];
  }
  const firstCombat = adventure.sceneOrder.find(
    (id) => adventure.scenes[id]?.kind === 'combat',
  );
  if (firstCombat && adventure.sceneEncounters?.[firstCombat]) {
    return resolveCombatMonsters(adventure, firstCombat, playerLevel);
  }
  return adventure.monsters.map((m) => ({ ...m }));
}
