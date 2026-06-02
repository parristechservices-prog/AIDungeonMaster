import { buildBuiltinRegistry, DEFAULT_ADVENTURE_ID } from './builtin-registry';
import type { Adventure } from './types';

export { getFirstPlayableSceneId } from './helpers';

let cache: Map<string, Adventure> | null = null;

function registry(): Map<string, Adventure> {
  if (!cache) {
    cache = buildBuiltinRegistry();
  }
  return cache;
}

export function resetAdventureRegistry(): void {
  cache = null;
}

/** Built-in + template/private modules loaded on server via registry.server.ts */
export function getAdventure(id: string): Adventure {
  return registry().get(id) ?? registry().get(DEFAULT_ADVENTURE_ID)!;
}

export function listAdventures(): Adventure[] {
  return Array.from(registry().values());
}

export function listAdventureIds(): string[] {
  return Array.from(registry().keys());
}

export function isValidAdventureId(id: string): boolean {
  return registry().has(id);
}

export function listAdventuresForCatalog(): Array<{
  id: string;
  title: string;
  tagline: string;
  estimatedMinutes: number;
  tone: string;
  recommendedCharacters: string[];
  source: Adventure['source'];
  levelRange?: [number, number];
}> {
  return listAdventures().map(
    ({ id, title, tagline, estimatedMinutes, tone, recommendedCharacters, source, levelRange }) => ({
      id,
      title,
      tagline,
      estimatedMinutes,
      tone,
      recommendedCharacters,
      source,
      levelRange,
    }),
  );
}

export { DEFAULT_ADVENTURE_ID };
