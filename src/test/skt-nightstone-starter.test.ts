import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { adventureModuleSchema } from '@/lib/game/adventures/module-schema';
import { visibleNpcsForScene } from '@/lib/game/adventures/visibility';
import { createInitialState } from '@/lib/game/state';
import { advanceScene } from '@/lib/game/state';
import { deriveDmTurnFromInput } from '@/lib/orchestrator/mock-dm';
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
    expect(parsed.data?.chapters).toHaveLength(3);
    expect(parsed.data?.sceneOrder).toContain('hark-showdown');
    expect(parsed.data?.sceneOrder).toContain('tower-of-zephyros');
  });

  it('loads from template registry', () => {
    const adventure = getAdventure('skt-nightstone-starter');
    expect(adventure.source).toBe('template');
    expect(adventure.sceneOrder[0]).toBe('settlement-arrival');
    expect(adventure.levelRange).toEqual([1, 5]);
  });

  it('answers passive looking without rolling or advancing', () => {
    const state = createInitialState('test-skt-look', {
      adventureId: 'skt-nightstone-starter',
      characterIds: ['fighter'],
    });

    const turn = deriveDmTurnFromInput(state, 'i look around');

    expect(turn.engineRequests).toEqual([]);
    expect(turn.narration.toLowerCase()).toContain('drawbridge');
    expect(turn.narration.toLowerCase()).toContain('bell');
  });

  it('answers distance questions without turning them into failed searches', () => {
    const atDrawbridge = advanceScene(createInitialState('test-skt-distance', {
      adventureId: 'skt-nightstone-starter',
      characterIds: ['fighter'],
    }));
    const inSquare = advanceScene(atDrawbridge);

    const turn = deriveDmTurnFromInput(inSquare, 'i move closer, how many feet am i from the bridge?');

    expect(turn.engineRequests).toEqual([]);
    expect(turn.narration.toLowerCase()).toContain('drawbridge');
    expect(turn.narration).toContain('80 to 120 feet');
  });

  it('only exposes NPCs near the current Nightstone starter scene', () => {
    const adventure = getAdventure('skt-nightstone-starter');

    expect(visibleNpcsForScene(adventure.id, 'village-square', adventure.npcs)).toEqual([]);
    expect(visibleNpcsForScene(adventure.id, 'nightstone-inn', adventure.npcs).map((npc) => npc.id)).toEqual(['npc-kella']);
  });
});
