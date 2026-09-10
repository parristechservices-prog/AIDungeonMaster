import { getPlayableScene } from '@/lib/game/adventures/helpers';
import { getAdventure } from '@/lib/game/adventures/registry.server';
import type { GameState } from '@/lib/game/types';
import type { DmTurn } from '@/lib/llm/contracts';

export type DmTurnValidation = {
  ok: boolean;
  errors: DmTurnValidationError[];
  issues: string[];
};

export type DmTurnValidationError = {
  code: string;
  message: string;
  requestIndex?: number;
};

const PLAYER_OWNED_KINDS = new Set([
  'skill_check',
  'player_attack',
  'death_save',
  'use_feature',
  'cast_spell',
  'update_inventory',
]);

const ACTOR_KINDS = new Set([
  'move_area',
  'query_current_area',
  'query_exits',
  'query_actors_present',
  'move_creature',
  'dash',
  'disengage',
  'query_reachable',
  'query_targets_in_range',
  'check_line_of_sight',
]);

const TARGETED_MONSTER_KINDS = new Set(['player_attack']);
const KNOWN_SPELLS = ['cure wounds', 'healing word', 'magic missile', 'shield', 'bless'];
const RESOLVED_OUTCOME = /\b(succeed(?:s|ed)?|fail(?:s|ed|ure)?|hits?|miss(?:es|ed)?|kills?|defeats?|deals?\s+\d+|takes?\s+\d+\s+damage|restores?\s+\d+|finds?|discovers?|unlocks?|opens?)\b/i;

export function validateDmTurn(turn: DmTurn, state: GameState): DmTurnValidation {
  const errors: DmTurnValidationError[] = [];
  const addError = (code: string, message: string, requestIndex?: number) => {
    errors.push({ code, message, requestIndex });
  };
  const partyIds = new Set(state.party.map((character) => character.id));
  const activeMonsterIds = new Set(state.monsters.filter((monster) => monster.hp > 0).map((monster) => monster.id));
  const targetIds = new Set([...partyIds, ...activeMonsterIds]);

  for (const [requestIndex, request] of turn.engineRequests.entries()) {
    const character = 'characterId' in request
      ? state.party.find((member) => member.id === request.characterId)
      : undefined;

    if (PLAYER_OWNED_KINDS.has(request.kind)) {
      const characterId = 'characterId' in request ? request.characterId : undefined;
      if (!characterId || !partyIds.has(characterId)) {
        addError('invalid_character_id', `${request.kind} must use a characterId from state.party.`, requestIndex);
      }
    }

    if (character?.unconscious && request.kind !== 'death_save') {
      addError('unconscious_character_action', `${character.name} is unconscious and cannot use ${request.kind}.`, requestIndex);
    }
    if (request.kind === 'death_save' && character && !character.unconscious) {
      addError('conscious_death_save', `${character.name} is conscious and cannot make a death save.`, requestIndex);
    }

    if (request.kind === 'update_npc') {
      const npcId = ('npcId' in request ? request.npcId : undefined) as string | undefined;
      if (npcId && !state.npcs.some((npc) => npc.id === npcId)) {
        addError('invalid_npc_id', 'update_npc must use a valid npcId.', requestIndex);
      }
    }

    if (ACTOR_KINDS.has(request.kind)) {
      const actorId = ('actorId' in request ? request.actorId : undefined) as string | undefined;
      if (actorId && !targetIds.has(actorId) && !state.npcs.some(n => n.id === actorId)) {
        addError('invalid_actor_id', `${request.kind} uses an invalid actorId.`, requestIndex);
      }
    }

    if (request.kind === 'cast_spell') {
      const spellName = request.spellName.toLowerCase();
      if (!KNOWN_SPELLS.some((known) => spellName.includes(known))) {
        addError('unknown_spell', 'cast_spell must use a recognized spell name.', requestIndex);
      }
      if (character?.knownSpells && !character.knownSpells.some((known) => known.toLowerCase() === spellName)) {
        addError('spell_not_known', `${character.name} does not know ${request.spellName}.`, requestIndex);
      }
      if (character && request.level > 0) {
        const slot = character.spellSlots[request.level];
        if (!slot || slot.remaining <= 0) {
          addError('spell_slot_unavailable', `cast_spell requires an available level ${request.level} spell slot.`, requestIndex);
        }
      }
    }

    if (request.kind === 'use_feature' && character) {
      const feature = character.features.find((candidate) => candidate.id === request.featureId);
      if (!feature) {
        addError('unknown_feature', `${character.name} does not have feature ${request.featureId}.`, requestIndex);
      } else if (feature.usesRemaining <= 0) {
        addError('feature_unavailable', `${feature.name} has no uses remaining.`, requestIndex);
      }
    }

    if (request.kind === 'update_inventory') {
      const missing = (request.remove ?? []).filter((item) => character && !character.inventory.includes(item));
      if (missing.length > 0) {
        addError('inventory_item_missing', `update_inventory cannot remove missing items: ${missing.join(', ')}.`, requestIndex);
      }
      if (character && (character.gold + (request.goldDelta ?? 0)) < 0) {
        addError('negative_gold', 'update_inventory cannot result in negative gold.', requestIndex);
      }
    }

    if (request.kind === 'apply_condition' || request.kind === 'remove_condition') {
      const exists = state.party.some((p) => p.id === request.targetId) || activeMonsterIds.has(request.targetId);
      if (!exists) {
        addError('invalid_condition_target', `${request.kind} must target an existing character or active monster.`, requestIndex);
      }
    }

    if ('targetId' in request && request.targetId) {
      const validTargets = TARGETED_MONSTER_KINDS.has(request.kind) ? activeMonsterIds : targetIds;
      if (!validTargets.has(request.targetId)) {
        addError('invalid_target_id', `${request.kind} uses an invalid or inactive targetId.`, requestIndex);
      }
    }

    if (request.kind === 'advance_scene' && !isCurrentObjectiveComplete(state)) {
      addError('scene_objective_incomplete', 'advance_scene is not allowed before the current scene objective is complete.', requestIndex);
    }
  }

  if (turn.needsResultBeforeNarrating) {
    if (turn.engineRequests.length === 0) {
      addError('missing_engine_request', 'needsResultBeforeNarrating requires at least one engine request.');
    }
    if (RESOLVED_OUTCOME.test(turn.narration)) {
      addError('pre_resolved_narration', 'Narration resolves an outcome before the engine result is available.');
    }
  } else {
    const requiresResult = turn.engineRequests.some((r) => 
      ['move_area', 'move_creature', 'dash', 'disengage', 'skill_check', 'player_attack'].includes(r.kind)
    );
    if (requiresResult) {
      addError('missing_needs_result', 'Engine requests that can fail (like movement or attacks) require needsResultBeforeNarrating to be true.');
    }
  }

  const uniqueErrors = errors.filter(
    (error, index) => errors.findIndex((candidate) =>
      candidate.code === error.code &&
      candidate.message === error.message &&
      candidate.requestIndex === error.requestIndex
    ) === index,
  );
  return { ok: uniqueErrors.length === 0, errors: uniqueErrors, issues: uniqueErrors.map((error) => error.message) };
}

export function validateManualD20Roll(value: unknown): string | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 20
    ? null
    : 'manualRoll must be an integer between 1 and 20.';
}

function isCurrentObjectiveComplete(state: GameState): boolean {
  const scene = getPlayableScene(getAdventure(state.adventureId), state.sceneId);
  if (!scene) return false;
  if (scene.kind === 'combat') return state.monsters.every((monster) => monster.hp <= 0);

  const successConditions = scene.successConditions ?? [];
  if (successConditions.length === 0) return false;
  return successConditions.some((condition) => state.completedObjectives.includes(condition));
}

export function buildDmTurnRepairPrompt(playerInput: string, issues: string[], state?: GameState): string {
  return [
    'Repair your previous DM turn.',
    `Original player input: ${playerInput}`,
    'Validation failures:',
    ...issues.map((issue) => `- ${issue}`),
    ...(state
      ? [
          `Legal character IDs: ${state.party.map((character) => character.id).join(', ') || 'none'}`,
          `Legal active monster IDs: ${state.monsters.filter((monster) => monster.hp > 0).map((monster) => monster.id).join(', ') || 'none'}`,
          `Legal NPC IDs: ${state.npcs.map((npc) => npc.id).join(', ') || 'none'}`,
        ]
      : []),
    'Return only a corrected JSON object. Use only IDs present in CURRENT STATE. Do not narrate unresolved outcomes.',
  ].join('\n');
}
