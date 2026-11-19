import { describe, expect, it } from 'vitest';
import { createInitialState } from '@/lib/game/state';
import { getScenario } from '@/lib/game/scenarios';

describe('new game options', () => {
  it('creates fighter on brindlehook by default', () => {
    const state = createInitialState('t1');
    expect(state.characterTemplateId).toBe('fighter');
    expect(state.adventureId).toBe('brindlehook-inn');
    expect(state.player.className).toBe('Fighter');
    expect(state.npcs[0]?.name).toBe('Mira');
  });

  it('creates cleric on crypt with custom name and background', () => {
    const state = createInitialState('t2', {
      adventureId: 'crypt-of-whispers',
      characterId: 'cleric',
      playerName: 'Test Cleric',
      backgroundId: 'acolyte',
    });
    expect(state.player.name).toBe('Test Cleric');
    expect(state.player.className).toBe('Cleric');
    expect(state.adventureId).toBe('crypt-of-whispers');
    expect(state.canonLog.some((f) => f.content.includes('acolyte'))).toBe(true);
    expect(getScenario(state.adventureId).buildMonsters()[0]?.name).toContain('Skeleton');
  });

  it('creates a level-one wizard with 2014 class and acolyte equipment', () => {
    const { player } = createInitialState('wizard-gear', {
      characterId: 'wizard', playerLevel: 1, backgroundId: 'acolyte',
    });
    expect(player.inventory).toEqual(expect.arrayContaining(['Quarterstaff', 'Arcane Focus', 'Spellbook', 'Small Knife', 'Holy Symbol', 'Prayer Book', 'Belt Pouch']));
    expect(player.inventory).not.toContain('Healing Potion');
    expect(player.gold).toBe(15);
    expect(player.spellSlots).toEqual({ 1: { max: 2, remaining: 2 } });
  });

  it('gives the level-three fighter matching armor, ranged equipment and Action Surge', () => {
    const { player } = createInitialState('fighter-gear', { characterId: 'fighter' });
    expect(player.inventory).toEqual(expect.arrayContaining(['Chain Mail', 'Shield', 'Longsword', 'Light Crossbow', '20 Crossbow Bolts']));
    expect(player.ac).toBe(18);
    expect(player.features.some((feature) => feature.id === 'action_surge')).toBe(true);
  });

  it('creates rogue on smugglers cove', () => {
    const state = createInitialState('t3', {
      adventureId: 'smugglers-cove',
      characterId: 'rogue',
    });
    expect(state.npcs[0]?.name).toBe('Dockmaster Holt');
    expect(state.monsters.length).toBeGreaterThanOrEqual(2);
  });
});
