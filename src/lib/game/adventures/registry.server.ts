import 'server-only';

import { buildBuiltinRegistry } from './builtin-registry';
import { loadPrivateAdventures, loadTemplateAdventures } from './load-modules.server';
import type { Adventure } from './types';

export const DEFAULT_ADVENTURE_ID = 'brindlehook-inn';

let serverCache: Map<string, Adventure> | null = null;

function serverRegistry(): Map<string, Adventure> {
  if (!serverCache) {
    serverCache = buildBuiltinRegistry();
    for (const adventure of loadTemplateAdventures()) {
      serverCache.set(adventure.id, adventure);
    }
    for (const adventure of loadPrivateAdventures()) {
      serverCache.set(adventure.id, adventure);
    }
  }
  return serverCache;
}

export function resetServerAdventureRegistry(): void {
  serverCache = null;
}

export function getAdventure(id: string): Adventure {
  return serverRegistry().get(id) ?? serverRegistry().get(DEFAULT_ADVENTURE_ID)!;
}

export function listAdventures(): Adventure[] {
  return Array.from(serverRegistry().values());
}

export function listAdventureIds(): string[] {
  return Array.from(serverRegistry().keys());
}

export function isValidAdventureId(id: string): boolean {
  return serverRegistry().has(id);
}

export function listAdventuresForCatalog() {
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
