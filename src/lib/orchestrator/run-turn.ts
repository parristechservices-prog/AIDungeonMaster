import { resolveEngineRequest, runEnemyTurns } from '@/lib/engine';
import type { EngineRequest } from '@/lib/engine/types';
import { dmTurnSchema, type DmTurn } from '@/lib/llm/contracts';
import { getPlayableScene, getSceneChoices, getSceneGoal } from '@/lib/game/adventures/helpers';
import { getAdventure } from '@/lib/game/adventures/registry.server';
import { visibleMonstersForScene, visibleNpcsForScene } from '@/lib/game/adventures/visibility';
import { ENDING_SCENE_ID } from '@/lib/game/adventures/types';
import type { GameState } from '@/lib/game/types';
import { mockNarrationAfterResult } from '@/lib/orchestrator/mock-dm';

/** Matches `engineRequests` max in `dmTurnSchema`. */
export const MAX_ENGINE_REQUESTS_PER_TURN = 5;

type LlmEngineRequest = DmTurn['engineRequests'][number];

/** LLM schema omits manualRoll; inject it for physical-dice resolution. */
function toEngineRequest(request: LlmEngineRequest, manualRoll?: number): EngineRequest {
  if (manualRoll === undefined) {
    return request as EngineRequest;
  }
  if (request.kind === 'skill_check') {
    return { ...request, manualRoll };
  }
  if (request.kind === 'player_attack') {
    return { ...request, manualRoll };
  }
  if (request.kind === 'death_save') {
    return { ...request, manualRoll };
  }
  return request as EngineRequest;
}

export type TurnResult = {
  ok: boolean;
  mode: 'ai_director' | 'table_rules';
  aiUsed: boolean;
  fallbackUsed: boolean;
  adventureId: string;
  adventureTitle: string;
  sceneId: GameState['sceneId'];
  sceneGoal: string;
  sceneStarter?: string;
  nextChoices: string[];
  nextHook: string;
  narration: string;
  ambient?: 'none' | 'tavern' | 'dungeon' | 'combat' | 'exploration' | 'boss_fight';
  needsManualRoll?: boolean;
  needsResultBeforeNarrating?: boolean;
  manualRollContext?: {
    kind: 'skill_check' | 'player_attack';
    formula: string;
    dc?: number;
    advantage?: boolean;
    disadvantage?: boolean;
  };
  engineResults: Array<{ kind: string; summary: string; ok: boolean; breakdown?: import('@/lib/engine/types').RollBreakdown; critical?: boolean; spatial?: import('@/lib/engine/spatial').SpatialEngineResult }>;
  recentRolls: import('@/lib/engine/types').RollBreakdown[];
  narrationWarnings?: string[];
  state: {
    party: Array<{
      id: string;
      name: string;
      race: string;
      className: string;
      subclass?: string;
      hp: number;
      maxHp: number;
      ac: number;
      unconscious: boolean;
      deathSaves: { success: number; failure: number };
      features: import('@/lib/game/types').Character['features'];
      spellSlots: import('@/lib/game/types').Character['spellSlots'];
      gold: number;
      inventory: string[];
      conditions: import('@/lib/game/types').Condition[];
    }>;
    activeCharacterId: string;
    monsters: {
      id: string;
      name: string;
      hp: number;
      maxHp: number;
      ac: number;
      conditions: import('@/lib/game/types').Condition[];
      attackBonus?: number;
      damage?: string;
      attacks?: import('@/lib/game/types').Monster['attacks'];
      speedFt?: number;
      reachFt?: number;
      size?: import('@/lib/engine/spatial/tactical').CreatureSize;
    }[];
    npcs: GameState['npcs'];
    canonLog: GameState['canonLog'];
    combat: GameState['combat'];
    exploration?: GameState['exploration'];
    log: string[];
  };
};

export function runTurn(
  state: GameState,
  rawTurn: unknown,
  context: { mode: 'ai_director' | 'table_rules'; aiUsed: boolean; fallbackUsed: boolean; physicalDice?: boolean; manualRoll?: number },
): { state: GameState; response: TurnResult; pendingTurn?: DmTurn } {
  const prevScene = state.sceneId;
  const narrationState = state;
  const parsed = dmTurnSchema.safeParse(rawTurn);
  const fallback: DmTurn = {
    engineRequests: [],
    narration: 'I could not interpret that action. Try a clear intent like "I attack" or "I ask Mira about the courier."',
    needsResultBeforeNarrating: false,
  };
  const turn = parsed.success ? parsed.data : fallback;

  const engineResults = [] as TurnResult['engineResults'];
  const limitedRequests = turn.engineRequests.slice(0, MAX_ENGINE_REQUESTS_PER_TURN);

  let needsManualRoll = false;
  let manualRollContext: TurnResult['manualRollContext'] | undefined;
  let skipConsequencesAfterFailedCheck = false;
  // Enemy turns are run by the engine, in initiative order, as soon as play
  // reaches them. The DM's own monster_turn requests are absorbed, and once the
  // enemies have gone this turn a trailing end_turn would skip the hero's turn.
  let enemiesActed = false;
  const runEnemies = () => {
    const auto = runEnemyTurns(state);
    if (auto.results.length === 0) return;
    state = auto.state;
    enemiesActed = true;
    for (const r of auto.results) engineResults.push(r);
  };
  runEnemies();

  // Outcome of the most recent check this turn, for requests marked "when".
  let lastCheck: 'success' | 'failure' | undefined;

  let pendingRequests: DmTurn['engineRequests'] | undefined;
  let suppliedRoll = context.manualRoll;

  for (const [index, request] of limitedRequests.entries()) {
    if (request.when && request.when !== lastCheck) continue;
    // The Director separates resolving an approach from progressing the story.
    if (request.kind === 'advance_scene' && (state.sceneId !== prevScene || state.combat.active)) continue;
    if (context.mode === 'ai_director' && skipConsequencesAfterFailedCheck && request.when !== 'failure' &&
        ['advance_scene', 'complete_objective', 'move_area'].includes(request.kind)) continue;
    if (request.kind === 'monster_turn') continue;
    if (request.kind === 'end_turn' && enemiesActed) continue;
    // A natural 20 on a death save brings the character back with 1 HP, and they
    // still take the rest of their turn (5e), so don't end it for them.
    const prev = engineResults[engineResults.length - 1];
    if (request.kind === 'end_turn' && prev?.kind === 'death_save' && state.party.some((p) => p.id === state.combat.initiative[state.combat.turnIndex]?.actorId && !p.unconscious)) continue;
    if (
      skipConsequencesAfterFailedCheck &&
      request.when !== 'failure' &&
      ['update_npc', 'add_canon_fact', 'update_inventory', 'apply_condition', 'remove_condition', 'remove_combatant', 'end_combat', 'advance_scene', 'complete_objective'].includes(request.kind)
    ) {
      continue;
    }

    // Attacking enemies outside combat starts the fight properly (5e): roll
    // initiative first; anyone faster acts before the attack lands. Surprise is
    // the DM's call via start_combat.surprised.
    if (
      ['player_attack', 'grapple', 'shove'].includes(request.kind) &&
      !state.combat.active &&
      state.monsters.some((m) => m.hp > 0)
    ) {
      const started = resolveEngineRequest(state, { kind: 'start_combat' });
      if (started.result.ok) {
        state = started.state;
        engineResults.push({ kind: 'start_combat', ...started.result });
        runEnemies();
        const actor = state.party.find((p) => p.id === ('characterId' in request ? request.characterId : ''));
        if (!state.combat.active || actor?.unconscious) continue;
      }
    }

    const manualRoll =
      suppliedRoll !== undefined &&
      (request.kind === 'skill_check' || request.kind === 'player_attack')
        ? suppliedRoll
        : undefined;

    const sceneBefore = state.sceneId;
    if (manualRoll !== undefined) suppliedRoll = undefined;
    const resolved = resolveEngineRequest(state, toEngineRequest(request, manualRoll), {
      physicalDice: context.physicalDice,
      advanceOnSkillSuccess: context.mode === 'table_rules',
    });
    state = resolved.state;
    engineResults.push({ kind: request.kind, ...resolved.result });
    // A check that completed the scene goal moved the story on: record it like an advance.
    if (request.kind !== 'advance_scene' && state.sceneId !== sceneBefore && state.sceneId !== 'ending' && !state.combat.active) {
      engineResults.push({ kind: 'advance_scene', ok: true, summary: 'Scene advanced.' });
    }
    if (state.combat.active && !resolved.result.needsManualRoll) runEnemies();
    if (['skill_check', 'contest', 'ability_check', 'saving_throw'].includes(request.kind) && !resolved.result.needsManualRoll) {
      lastCheck = resolved.result.ok ? 'success' : 'failure';
    }
    // Later requests describe the next steps of this action. If travel failed,
    // those steps cannot use the intended destination as their starting point.
    if (context.mode === 'ai_director' && request.kind === 'move_area' && !resolved.result.ok) break;
    if (['skill_check', 'contest', 'ability_check'].includes(request.kind) && !resolved.result.ok) {
      skipConsequencesAfterFailedCheck = true;
    }

    if (resolved.result.needsManualRoll) {
      needsManualRoll = true;
      manualRollContext = resolved.result.manualRollContext;
      pendingRequests = limitedRequests.slice(index);
      break; // Stop processing further requests if we need a roll
    }
  }

  // Handle post-resolution narration for fallback/mock DM
  let finalNarration = turn.narration;
  
  // CRITICAL FIX: If AI establishes a fact or NPC detail, the narration should 
  // reflect that, but we also need to ensure the AI knows to SAVE these to the engine.
  // If the AI just narrates but doesn't send 'add_canon_fact', it's lost.
  
  if (turn.needsResultBeforeNarrating) {
    const mainResult = engineResults[0];
    if (mainResult) {
      if (context.fallbackUsed) {
        const scripted = mockNarrationAfterResult(narrationState, mainResult.kind, mainResult.ok, mainResult.summary);
        if (scripted) {
          finalNarration = scripted;
        } else if (mainResult.kind === 'player_attack') {
          finalNarration = mainResult.ok
            ? `Your strike finds its mark! ${mainResult.summary}`
            : `Your blow is parried. ${mainResult.summary}`;
        } else {
          const lines = engineResults.filter((r) => !['end_turn', 'monster_turn', 'surprised'].includes(r.kind)).map((r) => r.summary);
          finalNarration = `${turn.narration} ${lines.join(' ')}`.trim();
        }
      }
    }
  }

  const enemyLines = engineResults.filter((r) => r.kind === 'monster_turn' || r.kind === 'surprised').map((r) => r.summary);
  if (enemiesActed && context.fallbackUsed && enemyLines.length) {
    finalNarration = `${finalNarration} ${enemyLines.join(' ')}`.trim();
  }

  const adventure = getAdventure(state.adventureId);
  const playable = getPlayableScene(adventure, state.sceneId);
  const sceneStarter = state.sceneId !== prevScene ? playable?.starter : undefined;
  const nextChoices = getSceneChoices(adventure, state.sceneId);
  const nextHook =
    state.sceneId === ENDING_SCENE_ID ? adventure.endingMessage : 'Choose your next action.';
  const recentRolls = engineResults
    .map((r) => r.breakdown)
    .filter((b): b is import('@/lib/engine/types').RollBreakdown => !!b);
  return {
    state,
    pendingTurn: pendingRequests ? { ...turn, engineRequests: pendingRequests } : undefined,
    response: {
      ok: true,
      mode: context.mode,
      aiUsed: context.aiUsed,
      fallbackUsed: context.fallbackUsed,
      adventureId: state.adventureId,
      adventureTitle: adventure.title,
      sceneId: state.sceneId,
      sceneGoal: getSceneGoal(adventure, state.sceneId),
      sceneStarter,
      nextChoices,
      nextHook,
      narration: finalNarration,
      ambient: turn.ambient,
      needsManualRoll,
      // Enemy turns happened after the DM wrote its narration, so it must be re-narrated from results.
      needsResultBeforeNarrating: turn.needsResultBeforeNarrating || enemiesActed,
      manualRollContext,
      engineResults,
      recentRolls,
      state: {
        party: state.party.map((p) => ({
          id: p.id,
          name: p.name,
          race: p.race,
          className: p.className,
          subclass: p.subclass,
          level: p.level,
          hp: p.hp,
          maxHp: p.maxHp,
          ac: p.ac,
          proficiencyBonus: p.proficiencyBonus,
          abilities: p.abilities,
          skills: p.skills,
          unconscious: p.unconscious,
          deathSaves: p.deathSaves,
          features: p.features,
          spellSlots: p.spellSlots,
          gold: p.gold,
          inventory: p.inventory,
          conditions: p.conditions,
        })),
        activeCharacterId: state.activeCharacterId,
        monsters: visibleMonstersForScene(adventure, state).map((m) => ({
          id: m.id,
          name: m.name,
          hp: m.hp,
          maxHp: m.maxHp,
          ac: m.ac,
          conditions: m.conditions,
          // Combat-facing stat-block data for the DM-view monster panel (not secret).
          attackBonus: m.attackBonus,
          damage: m.damage,
          attacks: m.attacks,
          speedFt: m.speedFt,
          reachFt: m.reachFt,
          size: m.size,
        })),
        npcs: visibleNpcsForScene(state.adventureId, state.sceneId, state.npcs),
        canonLog: state.canonLog,
        combat: state.combat,
        exploration: state.exploration,
        log: state.log.slice(-10),
      },
    },
  };
}

