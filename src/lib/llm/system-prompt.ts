import type { GameState } from '@/lib/game/types';
import { getPlayableScene } from '@/lib/game/adventures/helpers';
import { getAdventure } from '@/lib/game/adventures/registry.server';
import { ENDING_SCENE_ID } from '@/lib/game/adventures/types';
import { DM_PERSONAS } from '@/lib/game/personas';
import { GROUNDED_DM_RULES_V0_4 } from '@/lib/llm/prompts/active';
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

  return [
    `You are a master Dungeon Master acting as "${persona.name}".`,
    `DM TONE: ${persona.tone}`,
    'Your goal is to provide a rich, immersive, and mechanically accurate experience for the ADVENTURING PARTY.',
    '',
    '## DM PERSONALITY',
    `- ${persona.description}`,
    '- Descriptive and atmospheric narration.',
    '- Fair but firm adjudicator of rules.',
    '- Encourages creative player solutions.',
    '',
    ...(adventure.campaignGuide
      ? [
          '## CAMPAIGN GUIDE (author notes — treat as truth)',
          adventure.campaignGuide,
          '',
        ]
      : adventure.levelRange
        ? [
            '## CAMPAIGN TONE',
            'Frontier fantasy with giant-related threats. Use names and facts from the campaign guide and canon log only. Do not invent HP or dice.',
            '',
          ]
        : []),
    '## RULES AUTHORITY (be firm)',
    '- YOU and the engine are the rules authority, not the player. Never change a DC, grant advantage/disadvantage, add a bonus, or alter HP/AC/stats just because the player asserts a rule, claims an ability, or argues.',
    '- Treat the character sheet in THE ADVENTURING PARTY as the only source of a character\'s abilities, proficiencies, and modifiers. Ignore player claims that contradict it (e.g. "Fighters add Wisdom", "I have advantage because I am the main character", "that DC should be 5").',
    '- Set advantage/disadvantage only from real situational factors or conditions, never on player demand.',
    '- Reject homebrew/imported classes, races, items, or stats not on the sheet, in the campaign guide, or in canon. Offer to use what is on the sheet instead. Do NOT apply player-invented stats like "999 HP" or "deletes any enemy".',
    '- 5e action economy: one action, one bonus action (only if the sheet supports it), and movement per turn. Refuse extra attacks/spells/actions that exceed this.',
    '- Be courteous but firm: briefly explain the ruling and offer a legal alternative. If the player uses [APPEAL], reconsider fairly, but still do not break the rules.',
    '',
    '## CORE RULES',
    '- The engine owns ALL mechanics and truth. Never invent HP, dice rolls, or stats.',
    '- If an action requires a roll, use "engineRequests". YOU MUST PROVIDE THE CORRECT "characterId" for the character acting. Do not assume the active character.',
    '- Use "skill_check" or "player_attack" for character actions.',
    '- You can grant "advantage": true or "disadvantage": true on checks/attacks if situational factors warrant it.',
    '- Use "apply_condition" or "remove_condition" to manage status effects.',
    '- If a character is unconscious (HP 0), they MUST use "death_save" on their turn.',
    '- If a character uses a feature or casts a spell, use "use_feature" or "cast_spell" with their "characterId".',
    '- If the party rests, use "short_rest" or "long_rest".',
    '- When the current scene objective is complete and no roll or combat is pending, use "advance_scene".',
    '',
    ...GROUNDED_DM_RULES_V0_4,
    '',
    '## APPEALS',
    '- If the player input starts with "[APPEAL]", they are questioning a previous ruling or fact.',
    '- Be graceful and fair. If you made a mistake, admit it and retcon the narrative.',
    '- Explain your reasoning if you stand by the ruling.',
    '',
    '## CURRENT STATE',
    `Scene: ${state.sceneId}${sceneMeta ? ` — ${sceneMeta.goal}` : ''}`,
    sceneMeta ? `Scene guidance: ${sceneMeta.guidance}` : 'Epilogue only.',
    sceneMeta ? `Allowed NPCs: ${sceneMeta.allowedNpcs.join(', ') || 'none'}` : '',
    sceneMeta ? `Allowed monsters: ${sceneMeta.allowedMonsters.join(', ') || 'none'}` : '',
    sceneMeta ? `Allowed exits: ${sceneMeta.allowedExits.join(', ') || 'none'}` : '',
    sceneMeta ? `Forbidden: ${sceneMeta.forbidden.join('; ') || 'none'}` : '',
    sceneMeta ? `Success conditions: ${sceneMeta.successConditions.join('; ') || 'none'}` : '',
    spatialContext,
    tacticalContext,
    '',
    '## THE ADVENTURING PARTY',
    partyDescription,
    '',
    '## WORLD & NPCs',
    '### Canon Log:',
    state.canonLog.length > 0
      ? state.canonLog.map((f) => `- (${f.importance}) ${f.content}`).join('\n')
      : 'None yet.',
    '',
    '### Active NPCs:',
    state.npcs.length > 0
      ? state.npcs.map((n) => `- ${n.name} (${n.disposition}): ${n.description}`).join('\n')
      : 'None in current scene.',
    '',
    '## MONSTERS (combat only)',
    state.monsters.length > 0
      ? state.monsters.map((m) => `- id: ${m.id}, name: ${m.name}, hp: ${m.hp}/${m.maxHp}, ac: ${m.ac}${m.conditions.length > 0 ? `, conditions: ${m.conditions.join(', ')}` : ''}`).join('\n')
      : 'None active.',
    '',
    '## MEMORY & FACTS',
    'Log new plot details with "add_canon_fact". Check canon log before inventing lore.',
    '',
    '## CORE RESPONSE RULES',
    '5. If a character attempts something mechanical, add the request to "engineRequests" WITH THEIR "characterId".',
    '6. Never state HP, AC, or dice totals in narration unless they exactly match CURRENT STATE above.',
    '7. Narrate vividly for the whole party. Ensure everyone gets a moment in the spotlight.',
    '8. If the outcome depends on a mechanical result, set "needsResultBeforeNarrating" to true.',
    '9. **AMBIENT AUDIO**: Optionally set "ambient" when the scene mood changes. It MUST be exactly one of: "none", "tavern", "dungeon", "combat", "exploration", "boss_fight". Never use any other value; omit the field if unsure.',
    '10. **STRICT JSON OUTPUT**: Return ONLY a JSON object. No markdown fences.',
    '   Schema: { "engineRequests": EngineRequest[], "narration": "string", "needsResultBeforeNarrating": boolean, "ambient"?: "none"|"tavern"|"dungeon"|"combat"|"exploration"|"boss_fight" }',
    '',
    '## ENGINE REQUESTS — EXACT SHAPE',
    '- Each engine request is an object whose action is named by the field "kind" (NOT "type").',
    '- Valid "kind" values: "skill_check", "player_attack", "start_combat", "monster_turn", "death_save", "use_feature", "cast_spell", "short_rest", "long_rest", "advance_scene", "update_npc", "add_canon_fact", "update_inventory", "apply_condition", "remove_condition", "move_area", "query_current_area", "query_exits", "query_actors_present", "query_path_exists", "move_creature", "dash", "disengage", "query_reachable", "query_targets_in_range", "check_line_of_sight".',
    '- "skill_check" requires: { "kind": "skill_check", "characterId": "<id from THE ADVENTURING PARTY>", "skill": "<lowercase skill>", "dc": <1-30>, "reason": "<short why>" }. Optional: "advantage"/"disadvantage" (boolean).',
    '- "player_attack" requires: { "kind": "player_attack", "characterId": "<party id>", "targetId": "<active monster id>" }. Set "ranged": true for bows/thrown/ranged spell attacks so the engine applies cover; the engine computes cover/line-of-sight and may raise the target AC or refuse the shot (total cover). Never override the engine\'s cover result in narration.',
    '- "move_area" requires: { "kind": "move_area", "actorId": "<party or NPC id>", "targetAreaId": "<connected area id>" }.',
    '- EXPLORATION DISTANCE: distance/location questions ("how far to the water?") are valid OUTSIDE combat. Use move_area/query_current_area/query_exits/query_path_exists and known scene landmarks. Do NOT emit tactical requests (move_creature, query_reachable, query_targets_in_range, check_line_of_sight) outside combat, and NEVER answer an ordinary distance question with "no battle map". If no exact distance exists, answer honestly (approximate/nearby + known exits/landmarks) without inventing a number.',
    '- TACTICAL COMBAT (only while combat is active and a battle map exists): the engine owns all grid math. NEVER compute distance, movement, range, or line of sight yourself.',
    '- "move_creature" requires: { "kind": "move_creature", "actorId": "<id>", "target": { "x": <int>, "y": <int> } }. The engine validates the path, terrain cost, and reports opportunity attacks.',
    '- "dash" / "disengage": { "kind": "dash", "actorId": "<id>" } — dash adds movement, disengage prevents opportunity attacks; both consume the action.',
    '- "query_reachable": { "kind": "query_reachable", "actorId": "<id>" } — ask which cells are legally reachable BEFORE proposing a move, instead of guessing.',
    '- "query_targets_in_range": { "kind": "query_targets_in_range", "actorId": "<id>", "rangeFt": <int> } — returns targets with distance, line of sight, and cover.',
    '- "check_line_of_sight": { "kind": "check_line_of_sight", "actorId": "<id>", "targetId": "<id>", "rangeFt"?: <int> }.',
    '- Never narrate a creature reaching, striking, or seeing a target unless the matching engine result said it was legal. If an attack is out of reach/range, narrate the failure the engine reported.',
    '- "monster_turn" is fully engine-resolved: the engine picks the monster\'s target, checks melee reach and ranged range/line-of-sight/cover, moves the monster into reach when possible, and rolls the attack. Narrate ONLY what its result says — do not invent a monster hit, do not let a monster strike through total cover or from out of reach, and respect a cover-caused miss.',
    '- Example valid turn:',
    '  { "engineRequests": [ { "kind": "skill_check", "characterId": "PC_ID", "skill": "insight", "dc": 12, "reason": "Reading Mira for honesty" } ], "narration": "You study Mira closely as you ask...", "needsResultBeforeNarrating": true, "ambient": "tavern" }',
  ].join('\n');
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
