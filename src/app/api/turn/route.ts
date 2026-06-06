import { NextResponse } from 'next/server';
import { shouldUseMockFlavorPrefix } from '@/lib/llm/credentials';
import { generateDmTurn, generateNarration } from '@/lib/llm/provider';
import { buildSystemPrompt } from '@/lib/llm/system-prompt';
import { validateNarrationAgainstState } from '@/lib/llm/validate-narration';
import { summarizeCanonLog } from '@/lib/llm/summarizer';
import { buildRecap } from '@/lib/game/recap';
import { isValidAdventureId } from '@/lib/game/adventures/registry.server';
import { deriveDmTurnFromInput } from '@/lib/orchestrator/mock-dm';
import { runTurn } from '@/lib/orchestrator/run-turn';
import { buildDmTurnRepairPrompt, validateDmTurn } from '@/lib/orchestrator/validate-dm-turn';
import { 
  getOrCreateSession, 
  nextTurnNumber, 
  saveRecap, 
  saveSession, 
  getRecaps,
  getPendingTurn,
  savePendingTurn,
  clearPendingTurn,
  startNewGame
} from '@/lib/orchestrator/session-store';
import { writeDevLog } from '@/lib/logging/dev-log';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const sessionId = typeof body?.sessionId === 'string' && body.sessionId.length > 0 ? body.sessionId : 'local-default';
  const requestedAdventureId =
    typeof body?.adventureId === 'string' && isValidAdventureId(body.adventureId)
      ? body.adventureId
      : undefined;
  const playerInput = typeof body?.playerInput === 'string' ? body.playerInput.slice(0, 800) : '';
  const manualRoll = typeof body?.manualRoll === 'number' ? body.manualRoll : undefined;
  const physicalDice = Boolean(body?.physicalDice);

  try {
    let state = getOrCreateSession(sessionId);
    if (requestedAdventureId && state.adventureId !== requestedAdventureId) {
      writeDevLog({
        type: 'turn_session_adventure_mismatch',
        sessionId,
        requestedAdventureId,
        sessionAdventureId: state.adventureId,
      });
      state = startNewGame(sessionId, {
        adventureId: requestedAdventureId,
        characterIds: state.characterTemplateIds,
        playerNames: state.party.map((p) => p.name),
        playerLevel: state.party[0]?.level,
        backgroundId: state.backgroundId,
        personaId: state.personaId,
      });
      clearPendingTurn(sessionId);
    }

    let rawTurn: unknown;
    let aiUsed = false;
    let fallbackUsed = false;
    let systemPrompt = '';

    // Check if we are resolving a pending turn with a manual roll.
    const pending = getPendingTurn(sessionId);
    if (pending && manualRoll !== undefined) {
      rawTurn = pending;
      clearPendingTurn(sessionId);
    } else {
      const recentRecaps = getRecaps(sessionId).slice(-5);
      systemPrompt =
        buildSystemPrompt(state) +
        (recentRecaps.length > 0
          ? `\n\n## RECENT CONVERSATION HISTORY\n${recentRecaps.map((r) => `Turn ${r.turnNumber} Narration: ${r.narration}`).join('\n')}`
          : '');

      let aiTurn = await generateDmTurn({
        systemPrompt,
        playerInput,
      });
      if (aiTurn) {
        const validation = validateDmTurn(aiTurn, state);
        if (!validation.ok) {
          writeDevLog({ type: 'dm_turn_validation', sessionId, issues: validation.issues });
          aiTurn = await generateDmTurn({
            systemPrompt,
            playerInput: buildDmTurnRepairPrompt(playerInput, validation.issues),
          });
          if (aiTurn && !validateDmTurn(aiTurn, state).ok) aiTurn = null;
        }
      }
      aiUsed = Boolean(aiTurn);
      fallbackUsed = !aiTurn;
      rawTurn = aiTurn ?? deriveDmTurnFromInput(state, playerInput);
    }

    const turn = runTurn(state, rawTurn, {
      mode: fallbackUsed ? 'table_rules' : 'ai_director',
      aiUsed,
      fallbackUsed,
      physicalDice,
      manualRoll,
    });

    if (turn.response.needsManualRoll) {
      savePendingTurn(sessionId, rawTurn);
    }

    state = turn.state;
    let narration = turn.response.narration;
    if (!fallbackUsed && aiUsed && turn.response.needsResultBeforeNarrating && systemPrompt) {
      const visibleState = `Party: ${state.party.map((p) => `${p.name} (${p.hp}/${p.maxHp})`).join('; ')}.`;
      const narrationRewrite = await generateNarration({
        systemPrompt,
        sceneDescription: state.sceneId,
        playerInput,
        originalNarration: narration,
        engineResults: turn.response.engineResults.map((r) => ({ kind: r.kind, summary: r.summary, ok: r.ok })),
        visibleState,
      });
      if (narrationRewrite) {
        narration = narrationRewrite;
      }
    }

    // Periodic Canon Log Summarization.
    if (state.canonLog.length >= 20) {
      const summarized = await summarizeCanonLog(state.canonLog);
      state = { ...state, canonLog: summarized };
    }

    saveSession(state);
    const turnNumber = nextTurnNumber(sessionId);

    narration = fallbackUsed && shouldUseMockFlavorPrefix()
      ? `The wind shifts and the tale steadies itself. ${narration}`
      : narration;

    const narrationWarnings = validateNarrationAgainstState(narration, state);
    if (narrationWarnings.length > 0) {
      writeDevLog({ type: 'narration_validation', sessionId, warnings: narrationWarnings });
    }

    const recap = buildRecap({
      state,
      turnNumber,
      narration,
      outcome: turn.response.engineResults[0]?.summary ?? turn.response.narration,
      consequences: turn.response.engineResults.map((r) => r.summary),
      nextChoices: turn.response.nextChoices,
      nextHook: turn.response.nextHook,
      mode: turn.response.mode,
      aiUsed: turn.response.aiUsed,
      fallbackUsed: turn.response.fallbackUsed,
    });
    saveRecap(sessionId, recap);

    const response = {
      ...turn.response,
      narration,
      narrationWarnings,
      sessionId,
      recap,
    };

    writeDevLog({ type: 'turn', sessionId, playerInput, response });
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown turn processing error';
    writeDevLog({
      type: 'turn_error',
      sessionId,
      playerInput,
      error: message,
    });
    return NextResponse.json(
      {
        ok: false,
        sessionId,
        error: 'Turn processing failed. Please try that action again.',
      },
      { status: 500 },
    );
  }
}
