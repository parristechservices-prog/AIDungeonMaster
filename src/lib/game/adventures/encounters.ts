import { buildBalancedEncounter, scaleEncounterForParty, type Difficulty } from '@/lib/engine/balancer';
import { getMonster } from '@/lib/game/monsters';
import type { Monster } from '@/lib/game/types';
import type { AuthoredBattleMap } from '@/lib/engine/spatial/tactical';
import type { Adventure } from './types';

export type SceneEncounterSpec = {
  difficulty?: Difficulty;
  /** Explicit template ids — spawns one of each */
  templates?: string[];
  /** Optional proper names, index-aligned with `templates` (e.g. Beedo, Vark). */
  names?: string[];
  /** Keep the explicit templates even for parties smaller than four. */
  unscaled?: boolean;
  /** Build from CR budget using these ids */
  auto?: boolean;
  preferredTemplates?: string[];
  /** Optional authored tactical terrain for this encounter's battle map. */
  battleMap?: AuthoredBattleMap;
};

/** The authored battle map for a combat scene, if any. */
export function encounterBattleMap(adventure: Adventure, sceneId: string): AuthoredBattleMap | undefined {
  return adventure.sceneEncounters?.[sceneId]?.battleMap;
}

export function resolveCombatMonsters(
  adventure: Adventure,
  sceneId: string,
  playerLevel: number,
): Monster[] {
  const spec = adventure.sceneEncounters?.[sceneId];
  const partySize = adventure.playConfig?.partySize ?? 1;
  const difficulty = spec?.difficulty ?? adventure.playConfig?.defaultDifficulty ?? 'medium';

  if (spec?.templates?.length) {
    const fixed = spec.templates.map((templateId, i) => {
      const m = getMonster(templateId);
      const name = spec.names?.[i];
      return { ...m, id: `${templateId}-${sceneId}-${i}`, ...(name ? { name } : {}) };
    });
    // Published encounters assume four characters. When a module opts in, scale
    // fixed fights down for smaller parties so they are at most "hard" (DMG XP).
    const scale = adventure.playConfig?.scaleFixedEncounters && partySize < 4 && !spec.unscaled;
    return scale ? scaleEncounterForParty(fixed, playerLevel, partySize) : fixed;
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
