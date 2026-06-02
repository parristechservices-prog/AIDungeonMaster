import { resolveEngineRequest } from '@/lib/engine';
import { dmTurnSchema, type DmTurn } from '@/lib/llm/contracts';
import { oneShot } from '@/lib/game/one-shot';
import type { GameState } from '@/lib/game/types';

export type TurnResult = {
  ok: boolean;
  mode: 'ai_director' | 'table_rules';
  aiUsed: boolean;
  fallbackUsed: boolean;
  sceneId: GameState['sceneId'];
  sceneGoal: string;
  sceneStarter?: string;
  nextChoices: string[];
  nextHook: string;
  narration: string;
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
        if (state.sceneId === 'social') {
          finalNarration = mainResult.ok 
            ? '"Fine," Mira sighs, leaning in. "He went to the boathouse. But he wasn\'t alone. Two cloaked figures were on his heels."'
            : 'Mira just shakes her head. "I don\'t want any trouble, stranger. Buy a drink or move on."';
        } else if (state.sceneId === 'exploration') {
          finalNarration = mainResult.ok
            ? 'You find fresh tracks—heavy boots, dragging something. They lead straight to the boathouse door.'
            : 'The rain has washed away the clearest signs. You catch a faint smell of salt and rot from the boathouse.';
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

  const sceneData = oneShot.scenes[state.sceneId as keyof typeof oneShot.scenes];
  const sceneStarter = state.sceneId !== prevScene ? sceneData?.starter : undefined;
  const nextChoices = choicesForScene(state.sceneId);
  const nextHook = state.sceneId === 'ending' ? 'Your tale concludes at Brindlehook Inn.' : 'Choose your next action.';
  const recentRolls = engineResults
    .map((r) => r.breakdown)
    .filter((b): b is NonNullable<typeof b> => Boolean(b));

  return {
    state,
    response: {
      ok: true,
      mode: context.mode,
      aiUsed: context.aiUsed,
      fallbackUsed: context.fallbackUsed,
      sceneId: state.sceneId,
      sceneGoal: sceneData?.goal ?? 'Finish the adventure.',
      sceneStarter,
      nextChoices,
      nextHook,
      narration: finalNarration,
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

function choicesForScene(sceneId: GameState['sceneId']): string[] {
  switch (sceneId) {
    case 'social':
      return ['Question Mira about the courier', 'Offer coin for information', 'Inspect the inn patrons'];
    case 'exploration':
      return ['Scout the boathouse approach', 'Search for hidden tracks', 'Call out to lure the ambushers'];
    case 'combat':
      return ['Strike the nearest ruffian', 'Use Second Wind', 'Hold position and watch for an opening'];
    case 'ending':
      return ['Review your recap', 'Start a fresh run'];
  }
}
