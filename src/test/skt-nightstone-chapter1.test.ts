import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { adventureModuleSchema } from '@/lib/game/adventures/module-schema';
import { visibleNpcsForScene } from '@/lib/game/adventures/visibility';
import { createInitialState } from '@/lib/game/state';
import { deriveDmTurnFromInput } from '@/lib/orchestrator/mock-dm';
import { getAdventure, resetServerAdventureRegistry } from '@/lib/game/adventures/registry.server';

describe('skt-nightstone-chapter1 template', () => {
  beforeEach(() => {
    resetServerAdventureRegistry();
  });

  it('validates committed template JSON', () => {
    const filePath = path.join(process.cwd(), 'content/templates/skt-nightstone-chapter1/module.json');
    const raw = JSON.parse(readFileSync(filePath, 'utf8'));
    const parsed = adventureModuleSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.chapters).toHaveLength(1);
    expect(parsed.data?.sceneOrder.at(-1)).toBe('ending');
  });

  it('loads from template registry', () => {
    const adventure = getAdventure('skt-nightstone-chapter1');
    expect(adventure.source).toBe('template');
    expect(adventure.sceneOrder[0]).toBe('road-to-nightstone');
    expect(adventure.levelRange).toEqual([1, 5]);
  });

  it('answers passive looking without forcing a search roll', () => {
    const state = createInitialState('test-chapter1-look', {
      adventureId: 'skt-nightstone-chapter1',
      characterIds: ['fighter'],
    });

    const turn = deriveDmTurnFromInput(state, 'i look around');

    expect(turn.engineRequests).toEqual([]);
    expect(turn.narration.toLowerCase()).toContain('nightstone');
    expect(turn.narration.toLowerCase()).toContain('drawbridge');
  });

  it('hides future Chapter 1 NPCs until their scenes', () => {
    const adventure = getAdventure('skt-nightstone-chapter1');

    expect(visibleNpcsForScene(adventure.id, 'village-square', adventure.npcs)).toEqual([]);
    expect(visibleNpcsForScene(adventure.id, 'goblin-scouts', adventure.npcs).map((npc) => npc.id)).toEqual(['npc-goblin-captive']);
    expect(visibleNpcsForScene(adventure.id, 'dripping-caves', adventure.npcs).map((npc) => npc.id)).toEqual(['npc-nightstone-survivor']);
  });
});
