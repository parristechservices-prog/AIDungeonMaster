import type { GameState } from '@/lib/game/types';
import { getPlayableScene } from '@/lib/game/adventures/helpers';
import { getAdventure } from '@/lib/game/adventures/registry.server';
import { ENDING_SCENE_ID } from '@/lib/game/adventures/types';
import { DM_PERSONAS } from '@/lib/game/personas';
import { buildDmSystemPromptV05 } from './prompts/dm-system.v0.5';
import { actorsInSameArea, getArea, getNeighbors } from '@/lib/engine/spatial';
import { remainingMovementFt, targetsInRange } from '@/lib/engine/spatial/tactical';

export function buildSystemPrompt(state: GameState): string {
  const adventure = getAdventure(state.adventureId);
  const persona = DM_PERSONAS[state.personaId || 'balanced'];
  const sceneMeta =
    state.sceneId !== ENDING_SCENE_ID ? getPlayableScene(adventure, state.sceneId) : undefined;
  const spatialContext = buildSpatialPromptBlock(state);
  const tacticalContext = buildTacticalPromptBlock(state);

  const partyDescription = state.party.map(p => {
    const featuresList = p.features.map((f) => `${f.name} (${f.usesRemaining}/${f.usesMax})`).join(', ');
    const slotsList = Object.entries(p.spellSlots)
      .map(([lvl, s]) => `Lvl ${lvl}: ${s.remaining}/${s.max}`)
      .join(', ');
    const abilitiesList = Object.entries(p.abilities)
      .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
      .join(', ');
    const skillsList = Object.entries(p.skills)
      .map(([k, v]) => `${k}: +${v}`)
      .join(', ');

    return [
      `### Character: ${p.name} (ID: ${p.id})`,
      `- Role: Level ${p.level} ${p.race} ${p.className} ${p.subclass ? `(${p.subclass})` : ''}`,
      `- Stats: ${abilitiesList}`,
      `- Skills: ${skillsList || 'None trained'}`,
      `- Combat: HP ${p.hp}/${p.maxHp}, AC ${p.ac}, Prof Bonus +${p.proficiencyBonus}`,
      p.conditions.length > 0 ? `- CONDITIONS: ${p.conditions.join(', ')}` : '',
      p.unconscious ? `- STATUS: UNCONSCIOUS (Death Saves: ${p.deathSaves.success} Successes, ${p.deathSaves.failure} Failures)` : '',
      `- Inventory: ${p.inventory.join(', ') || 'Empty'}`,
      `- Features: ${featuresList || 'None'}`,
      `- Spell Slots: ${slotsList || 'None'}`,
      `- Known Spells: ${p.knownSpells?.join(', ') || 'None'}`,
    ].join('\n');
  }).join('\n\n');

  return buildDmSystemPromptV05(
    state,
    persona,
    sceneMeta,
    spatialContext,
    tacticalContext,
    partyDescription,
    adventure.levelRange ? 'Frontier fantasy with giant-related threats. Use names and facts from the campaign guide and canon log only. Do not invent HP or dice.' : undefined,
    adventure.campaignGuide
  );
}

function buildSpatialPromptBlock(state: GameState): string {
  if (!state.exploration) return '';
  const activeAreaId = state.exploration.locations[state.activeCharacterId];
  if (!activeAreaId) return '';

  try {
    const currentArea = getArea(state.exploration, activeAreaId);
    const exits = getNeighbors(state.exploration, activeAreaId)
      .map((connection) => {
        const area = state.exploration?.graph.areas[connection.to];
        const locked = connection.requires ? `, locked unless ${connection.requires.tag}` : '';
        const label = connection.label ? ` via ${connection.label}` : '';
        return `- ${connection.to}: ${area?.name ?? 'Unknown area'}${label}; difficulty ${connection.difficulty}${locked}`;
      })
      .join('\n');
    const present = actorsInSameArea(state.exploration, state.activeCharacterId);

    return [
      '## SPATIAL STATE',
      `Current area: ${currentArea.id} - ${currentArea.name}`,
      currentArea.description ? `Description: ${currentArea.description}` : '',
      `Exits:\n${exits || '- none'}`,
      `Other actors present: ${present.join(', ') || 'none'}`,
      'Never invent movement or arrival. Emit "move_area" for travel and narrate only the engine result. Use query_current_area, query_exits, query_actors_present, or query_path_exists before describing uncertain travel.',
    ].filter(Boolean).join('\n');
  } catch {
    return '';
  }
}

function buildTacticalPromptBlock(state: GameState): string {
  const map = state.combat.battleMap;
  if (!state.combat.active || !map) return '';
  const activeId = state.activeCharacterId;
  const self = map.actors[activeId];
  const pos = map.positions[activeId];
  if (!self || !pos) return '';

  try {
    // Show only nearby actors (within a generous radius) with engine-computed
    // distance/LOS/cover so the model never estimates geometry itself.
    const nearby = targetsInRange(map, activeId, 60)
      .map((t) => `- ${t.id}: ${t.distanceFt} ft${t.inReach ? ', in melee reach' : ''}${t.hasLineOfSight ? '' : ', no line of sight'}${t.cover !== 'none' ? `, ${t.cover} cover` : ''}`)
      .join('\n');

    return [
      '## TACTICAL COMBAT STATE',
      `Battle map: ${map.width}x${map.height}, ${map.cellSizeFt} ft squares (${map.diagonalMode}).`,
      `Active actor ${activeId} at (${pos.x},${pos.y}); movement remaining ${remainingMovementFt(self)} ft; action ${self.actionUsed ? 'used' : 'available'}.`,
      `Nearby actors:\n${nearby || '- none in 60 ft'}`,
      'Do not compute movement, range, or line of sight. Use move_creature/query_reachable/query_targets_in_range/check_line_of_sight and narrate only what the engine returns.',
    ].join('\n');
  } catch {
    return '';
  }
}
