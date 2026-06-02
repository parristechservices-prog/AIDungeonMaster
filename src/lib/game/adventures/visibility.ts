import type { NPC } from '@/lib/game/types';

const SKT_NIGHTSTONE_VISIBLE_NPCS: Record<string, string[]> = {
  'settlement-arrival': [],
  'drawbridge-watchtowers': [],
  'village-square': [],
  'temple-bell': [],
  'nightstone-inn': ['npc-kella'],
  'trading-post-and-windmill': [],
  'nandar-keep': [],
  'seven-snakes': ['npc-kella', 'npc-xolkin'],
  'ear-seekers': ['npc-xolkin'],
  'cave-leads': ['npc-goblin-captive'],
  'dripping-caves-approach': [],
  'main-cavern': [],
  'goblin-warrens': ['npc-snigbat'],
  'east-caves-and-prisoners': ['npc-nightstone-survivor', 'npc-morak'],
  'snigbat-bargain': ['npc-snigbat'],
  'hark-showdown': ['npc-hark', 'npc-snigbat'],
  'morak-quest': ['npc-nightstone-survivor', 'npc-morak'],
  'tower-of-zephyros': ['npc-zephyros'],
  'tower-life': ['npc-zephyros'],
  'unfriendly-skies-cult': ['npc-zephyros'],
  'unfriendly-skies-dwarves': ['npc-zephyros'],
  'chapter-transition': ['npc-zephyros', 'npc-morak'],
};

const SKT_NIGHTSTONE_CHAPTER1_VISIBLE_NPCS: Record<string, string[]> = {
  'road-to-nightstone': [],
  'open-palisade': [],
  'village-square': [],
  'chapel-bell': [],
  'goblin-scouts': ['npc-goblin-captive'],
  'trail-to-caves': ['npc-goblin-captive'],
  'dripping-caves': ['npc-nightstone-survivor'],
  'tower-of-zephyros': ['npc-nightstone-survivor', 'npc-tower-messenger'],
  ending: ['npc-nightstone-survivor', 'npc-tower-messenger'],
};

export function visibleNpcsForScene(
  adventureId: string,
  sceneId: string,
  npcs: NPC[],
): NPC[] {
  const visibleByScene =
    adventureId === 'skt-nightstone-starter'
      ? SKT_NIGHTSTONE_VISIBLE_NPCS
      : adventureId === 'skt-nightstone-chapter1'
        ? SKT_NIGHTSTONE_CHAPTER1_VISIBLE_NPCS
        : undefined;
  if (!visibleByScene) return npcs;
  const visibleIds = visibleByScene[sceneId];
  if (!visibleIds) return [];
  const visible = new Set(visibleIds);
  return npcs.filter((npc) => visible.has(npc.id));
}
