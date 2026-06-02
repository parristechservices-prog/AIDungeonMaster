import { resolveEngineRequest } from '@/lib/engine';
import type { EngineRequest } from '@/lib/engine/types';
import { dmTurnSchema, type DmTurn } from '@/lib/llm/contracts';
import { getPlayableScene, getSceneChoices, getSceneGoal } from '@/lib/game/adventures/helpers';
import { getAdventure } from '@/lib/game/adventures/registry.server';
import { visibleNpcsForScene } from '@/lib/game/adventures/visibility';
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
  manualRollContext?: {
    kind: 'skill_check' | 'player_attack';
    formula: string;
    dc?: number;
    advantage?: boolean;
    disadvantage?: boolean;
  };
  engineResults: Array<{ kind: string; summary: string; ok: boolean; breakdown?: import('@/lib/engine/types').RollBreakdown; critical?: boolean }>;
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
    monsters: { id: string; name: string; hp: number; maxHp: number; ac: number; conditions: import('@/lib/game/types').Condition[] }[];
    npcs: GameState['npcs'];
    canonLog: GameState['canonLog'];
    combat: GameState['combat'];
    log: string[];
  };
};

export function runTurn(
  state: GameState,
  rawTurn: unknown,
  context: { mode: 'ai_director' | 'table_rules'; aiUsed: boolean; fallbackUsed: boolean; physicalDice?: boolean; manualRoll?: number },
): { state: GameState; response: TurnResult } {
  const prevScene = state.sceneId;
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

  for (const request of limitedRequests) {
    const manualRoll =
      context.manualRoll !== undefined &&
      (request.kind === 'skill_check' || request.kind === 'player_attack')
        ? context.manualRoll
        : undefined;

    const resolved = resolveEngineRequest(state, toEngineRequest(request, manualRoll), {
      physicalDice: context.physicalDice,
    });
    state = resolved.state;
    engineResults.push({ kind: request.kind, ...resolved.result });

    if (resolved.result.needsManualRoll) {
      needsManualRoll = true;
      manualRollContext = resolved.result.manualRollContext;
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
        const scripted = mockNarrationAfterResult(state, mainResult.kind, mainResult.ok, mainResult.summary);
        if (scripted) {
          finalNarration = scripted;
        } else if (mainResult.kind === 'player_attack') {
          finalNarration = mainResult.ok
            ? `Your strike finds its mark! ${mainResult.summary}`
            : `Your blow is parried. ${mainResult.summary}`;
        }
      } else {
        // For AI, we can prepend the mechanical result if it's important and the AI didn't know it yet
        // But usually, we want the AI to narrate it. 
        // If needsResultBeforeNarrating is true, it means the AI wrote the lead-up, 
        // and we might need to append the result summary if the AI narration is "cut off".
        // However, the current architecture assumes AI narrates everything.
        // Let's add a small bridge for AI when it needs result.
        if (mainResult.summary && !finalNarration.includes(mainResult.summary)) {
          finalNarration += ` (${mainResult.summary})`;
        }
      }
    }
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
          unconscious: p.unconscious,
          deathSaves: p.deathSaves,
          features: p.features,
          spellSlots: p.spellSlots,
          gold: p.gold,
          inventory: p.inventory,
          conditions: p.conditions,
        })),
        activeCharacterId: state.activeCharacterId,
        monsters: state.monsters.map((m) => ({ id: m.id, name: m.name, hp: m.hp, maxHp: m.maxHp, ac: m.ac, conditions: m.conditions })),
        npcs: visibleNpcsForScene(state.adventureId, state.sceneId, state.npcs),
        canonLog: state.canonLog,
        combat: state.combat,
        log: state.log.slice(-10),
      },
    },
  };
}

