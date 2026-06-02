import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';
import { adventureModuleSchema } from './module-schema';
import { moduleFileToAdventure } from './from-module';
import type { Adventure } from './types';

function loadModulesFromRoot(
  rootDir: string,
  source: 'private' | 'template',
): Adventure[] {
  if (!existsSync(rootDir)) return [];

  const adventures: Adventure[] = [];
  const entries = readdirSync(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const modulePath = path.join(rootDir, entry.name, 'module.json');
    if (!existsSync(modulePath)) continue;

    try {
      const raw = JSON.parse(readFileSync(modulePath, 'utf8')) as unknown;
      const parsed = adventureModuleSchema.safeParse(raw);
      if (!parsed.success) {
        console.warn(`[adventures] Invalid module ${modulePath}:`, parsed.error.message);
        continue;
      }
      adventures.push(moduleFileToAdventure(parsed.data, source));
    } catch (e) {
      console.warn(`[adventures] Failed to read ${modulePath}:`, e);
    }
  }

  return adventures;
}

export function loadTemplateAdventures(): Adventure[] {
  return loadModulesFromRoot(path.join(process.cwd(), 'content', 'templates'), 'template');
}

export function loadPrivateAdventures(): Adventure[] {
  return loadModulesFromRoot(path.join(process.cwd(), 'content', 'private'), 'private');
}
