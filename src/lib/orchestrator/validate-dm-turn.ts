import { getPlayableScene } from '@/lib/game/adventures/helpers';
import { getAdventure } from '@/lib/game/adventures/registry.server';
import type { GameState } from '@/lib/game/types';
import type { DmTurn } from '@/lib/llm/contracts';

export type DmTurnValidation = {
  ok: boolean;
  issues: string[];
};

const PLAYER_OWNED_KINDS = new Set([
  'skill_check',
  'player_attack',
  'death_save',
  'use_feature',
  'cast_spell',
  'update_inventory',
]);

const TARGETED_MONSTER_KINDS = new Set(['player_attack']);
const KNOWN_SPELLS = ['cure wounds', 'healing word', 'magic missile', 'shield', 'bless'];
const RESOLVED_OUTCOME = /\b(succeed(?:s|ed)?|fail(?:s|ed|ure)?|hits?|miss(?:es|ed)?|kills?|defeats?|deals?\s+\d+|takes?\s+\d+\s+damage|restores?\s+\d+|finds?|discovers?|unlocks?|opens?)\b/i;

export function validateDmTurn(turn: DmTurn, state: GameState): DmTurnValidation {
  const issues: string[] = [];
  const partyIds = new Set(state.party.map((character) => character.id));
  const activeMonsterIds = new Set(state.monsters.filter((monster) => monster.hp > 0).map((monster) => monster.id));
  const targetIds = new Set([...partyIds, ...activeMonsterIds]);

  for (const request of turn.engineRequests) {
    if (PLAYER_OWNED_KINDS.has(request.kind)) {
      const characterId = 'characterId' in request ? request.characterId : undefined;
      if (!characterId || !partyIds.has(characterId)) {
        issues.push(`${request.kind} must use a characterId from state.party.`);
      }
    }

    if (request.kind === 'update_npc') {
      const npcId = ('npcId' in request ? request.npcId : undefined) as string | undefined;
      if (npcId && !state.npcs.some((npc) => npc.id === npcId)) {
        issues.push('update_npc must use a valid npcId.');
      }
    }

    if (request.kind === 'cast_spell') {
      const spellName = request.spellName.toLowerCase();
      if (!KNOWN_SPELLS.some((known) => spellName.includes(known))) {
        issues.push('cast_spell must use a recognized spell name.');
      }
      const character = state.party.find((p) => p.id === request.characterId);
      if (character && request.level > 0) {
        const slot = character.spellSlots[request.level];
        if (!slot || slot.remaining <= 0) {
          issues.push(`cast_spell requires an available level ${request.level} spell slot.`);
        }
      }
    }

    if (request.kind === 'update_inventory' && request.remove?.length) {
      const character = state.party.find((p) => p.id === request.characterId);
      const missing = request.remove.filter((item) => character && !character.inventory.includes(item));
      if (missing.length > 0) {
        issues.push(`update_inventory cannot remove missing items: ${missing.join(', ')}.`);
      }
      if (character && (character.gold + (request.goldDelta ?? 0)) < 0) {
        issues.push('update_inventory cannot result in negative gold.');
      }
    }

    if (request.kind === 'apply_condition' || request.kind === 'remove_condition') {
      const exists = state.party.some((p) => p.id === request.targetId) || state.monsters.some((m) => m.id === request.targetId);
      if (!exists) {
        issues.push(`${request.kind} must target an existing character or active monster.`);
      }
    }

    if ('targetId' in request && request.targetId) {
      const validTargets = TARGETED_MONSTER_KINDS.has(request.kind) ? activeMonsterIds : targetIds;
      if (!validTargets.has(request.targetId)) {
        issues.push(`${request.kind} uses an invalid or inactive targetId.`);
      }
    }

    if (request.kind === 'advance_scene' && !isCurrentObjectiveComplete(state)) {
      issues.push('advance_scene is not allowed before the current scene objective is complete.');
    }
  }

  if (turn.needsResultBeforeNarrating) {
    if (turn.engineRequests.length === 0) {
      issues.push('needsResultBeforeNarrating requires at least one engine request.');
    }
    if (RESOLVED_OUTCOME.test(turn.narration)) {
      issues.push('Narration resolves an outcome before the engine result is available.');
    }
  }

  return { ok: issues.length === 0, issues: [...new Set(issues)] };
}

function isCurrentObjectiveComplete(state: GameState): boolean {
  const scene = getPlayableScene(getAdventure(state.adventureId), state.sceneId);
  if (!scene) return false;
  if (scene.kind === 'combat') return state.monsters.every((monster) => monster.hp <= 0);

  const successConditions = scene.successConditions ?? [];
  if (successConditions.length === 0) return false;
  const log = state.log.join(' ').toLowerCase();
  return successConditions.some((condition) => {
    const keywords = condition.toLowerCase().match(/[a-z]{5,}/g) ?? [];
    return keywords.some((keyword) => log.includes(keyword));
  });
}

export function buildDmTurnRepairPrompt(playerInput: string, issues: string[]): string {
  return [
    'Repair your previous DM turn.',
    `Original player input: ${playerInput}`,
    'Validation failures:',
    ...issues.map((issue) => `- ${issue}`),
    'Return only a corrected JSON object. Use only IDs present in CURRENT STATE. Do not narrate unresolved outcomes.',
  ].join('\n');
}
