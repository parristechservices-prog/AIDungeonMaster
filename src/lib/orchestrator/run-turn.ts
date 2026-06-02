import { resolveEngineRequest } from '@/lib/engine';
import { dmTurnSchema, type DmTurn } from '@/lib/llm/contracts';
import { getScenario } from '@/lib/game/scenarios';
import type { GameState } from '@/lib/game/types';
import { mockNarrationAfterResult } from '@/lib/orchestrator/mock-dm';

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
  engineResults: Array<{ kind: string; summary: string; ok: boolean; breakdown?: import('@/lib/engine/types').RollBreakdown; critical?: boolean }>;
  recentRolls: import('@/lib/engine/types').RollBreakdown[];
  narrationWarnings?: string[];
  state: {
    player: {
      name: string;
      hp: number;
      maxHp: number;
      ac: number;
      features: GameState['player']['features'];
      spellSlots: GameState['player']['spellSlots'];
      gold: number;
      inventory: string[];
    };
    monsters: { id: string; name: string; hp: number; maxHp: number; ac: number }[];
    npcs: GameState['npcs'];
    canonLog: GameState['canonLog'];
    combat: GameState['combat'];
    log: string[];
  };
};

export function runTurn(
  state: GameState,
  rawTurn: unknown,
  context: { mode: 'ai_director' | 'table_rules'; aiUsed: boolean; fallbackUsed: boolean },
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
  const limitedRequests = turn.engineRequests.slice(0, 2);

  for (const request of limitedRequests) {
    const resolved = resolveEngineRequest(state, request);
    state = resolved.state;
    engineResults.push({ kind: request.kind, ...resolved.result });
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
        const scripted = mockNarrationAfterResult(state, mainResult.kind, mainResult.ok);
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

  const scenario = getScenario(state.adventureId);
  const playable = state.sceneId !== 'ending' ? scenario.scenes[state.sceneId] : undefined;
  const sceneStarter = state.sceneId !== prevScene ? playable?.starter : undefined;
  const nextChoices = playable?.choices ?? ['Start a fresh run'];
  const nextHook =
    state.sceneId === 'ending' ? scenario.endingMessage : 'Choose your next action.';
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
      adventureTitle: scenario.title,
      sceneId: state.sceneId,
      sceneGoal: playable?.goal ?? 'Finish the adventure.',
      sceneStarter,
      nextChoices,
      nextHook,
      narration: finalNarration,
      ambient: turn.ambient,
      engineResults,
      recentRolls,
      state: {
        player: {
        name: state.player.name,
        hp: state.player.hp,
        maxHp: state.player.maxHp,
        ac: state.player.ac,
        features: state.player.features,
        spellSlots: state.player.spellSlots,
        gold: state.player.gold,
        inventory: state.player.inventory,
      },
        monsters: state.monsters.map((m) => ({ id: m.id, name: m.name, hp: m.hp, maxHp: m.maxHp, ac: m.ac })),
        npcs: state.npcs,
        canonLog: state.canonLog,
        combat: state.combat,
        log: state.log.slice(-10),
      },
    },
  };
}

