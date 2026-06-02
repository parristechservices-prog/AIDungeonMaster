import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { adventureModuleSchema } from '@/lib/game/adventures/module-schema';
import {
  getAdventure,
  resetServerAdventureRegistry,
} from '@/lib/game/adventures/registry.server';

describe('skt-nightstone-starter template', () => {
  beforeEach(() => {
    resetServerAdventureRegistry();
  });

  it('validates committed template JSON', () => {
    const filePath = path.join(
      process.cwd(),
      'content/templates/skt-nightstone-starter/module.json',
    );
    const raw = JSON.parse(readFileSync(filePath, 'utf8'));
    const parsed = adventureModuleSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.chapters).toHaveLength(1);
  });

  it('loads from template registry', () => {
    const adventure = getAdventure('skt-nightstone-starter');
    expect(adventure.source).toBe('template');
    expect(adventure.sceneOrder[0]).toBe('settlement-arrival');
    expect(adventure.levelRange).toEqual([1, 5]);
  });
});
