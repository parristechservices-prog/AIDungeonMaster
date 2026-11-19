import { randomUUID } from 'node:crypto';
import { repairMissingEncounter } from '@/lib/engine';
import { NextResponse } from 'next/server';
import { shouldUseMockFlavorPrefix } from '@/lib/llm/credentials';
import { generateDmTurn, generateNarration } from '@/lib/llm/provider';
import { buildSystemPrompt } from '@/lib/llm/system-prompt';
import { buildEngineSafeNarration } from '@/lib/llm/validate-narration';
import { detectNarrationWarnings, healNarration } from '@/lib/orchestrator/heal-narration';
import { buildSourceLoreSection } from '@/lib/llm/source-lore/prompt.server';
import { pruneCanonLog, summarizeCanonLog } from '@/lib/llm/summarizer';
import { buildRecap } from '@/lib/game/recap';
import { isValidAdventureId } from '@/lib/game/adventures/registry.server';
import { deriveDmTurnFromInput } from '@/lib/orchestrator/mock-dm';
import { runTurn } from '@/lib/orchestrator/run-turn';
import { buildDmTurnRepairPrompt, validateDmTurn, validateManualD20Roll } from '@/lib/orchestrator/validate-dm-turn';
import { 
  getOrCreateSession, 
  nextTurnNumber, 
  saveRecap, 
  saveSession, 
  getRecaps,
  getPendingTurn,
  savePendingTurn,
  clearPendingTurn,
  startNewGame,
  getTurnCount,
} from '@/lib/orchestrator/session-store';
import { writeDevLog } from '@/lib/logging/dev-log';

function describeNightstoneBridge(adventureId: string, input: string): string | undefined {
  if (!adventureId.startsWith('skt-nightstone-')) return;
  const question = input.trim().replace(/[?.!]+$/, '').trim();
  if (!/^(?:tell me about|describe|what (?:can i see|do i see|is visible) (?:of|at|on)|what(?:'s| is))\s+.*\b(?:drawbridge|bridge)\b/i.test(question) ||
      /\b(?:then|and)\s+(?:i\s+)?(?:cross|jump|attack|move|run|walk)\b/i.test(question)) return;
  const keep = 'The stone bridge south of the village leads towards Nandar Keep. Its middle span is missing, leaving a gap between the village and the keep. There is no intact crossing.';
  const village = 'At the village entrance, the lowered wooden drawbridge spans the moat beside the open palisade gate.';
  if (/\b(?:keep|nandar|stone|broken|south)\b/i.test(question)) return keep;
  if (/\b(?:drawbridge|palisade|moat|wooden)\b/i.test(question)) return village;
  return `Nightstone has two bridges. ${village} ${keep}`;
}

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
  if (body?.manualRoll !== undefined) {
    const manualRollError = validateManualD20Roll(body.manualRoll);
    if (manualRollError) {
      return NextResponse.json({ ok: false, error: manualRollError }, { status: 400 });
    }
  }

  try {
    let state = repairMissingEncounter(await getOrCreateSession(sessionId));
    const configuredMaxTurns = Number(process.env.PARTYQUEST_MAX_TURNS_PER_SESSION ?? 0);
    const maxTurns = Number.isFinite(configuredMaxTurns) && configuredMaxTurns > 0
      ? Math.floor(configuredMaxTurns)
      : 0;
    const pending = getPendingTurn(sessionId);
    if (manualRoll !== undefined && (!pending || body.rollId !== pending.rollId ||
        (requestedAdventureId && requestedAdventureId !== state.adventureId))) {
      return NextResponse.json({ ok: false, error: 'This dice request is no longer active.' }, { status: 409 });
    }
    if (manualRoll === undefined && maxTurns > 0 && getTurnCount(sessionId) >= maxTurns) {
      return NextResponse.json({
        ok: false,
        sessionId,
        error: `This session has reached its ${maxTurns}-turn limit.`,
      }, { status: 429 });
    }
    if (requestedAdventureId && state.adventureId !== requestedAdventureId) {
      writeDevLog({
        type: 'turn_session_adventure_mismatch',
        sessionId,
        requestedAdventureId,
        sessionAdventureId: state.adventureId,
      });
      state = await startNewGame(sessionId, {
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
    if (manualRoll === undefined) clearPendingTurn(sessionId);
    const bridgeDescription = manualRoll === undefined
      ? describeNightstoneBridge(state.adventureId, playerInput)
      : undefined;
    if (pending && manualRoll !== undefined) {
      ({ turn: rawTurn, aiUsed, fallbackUsed, systemPrompt } = pending);
      clearPendingTurn(sessionId);
    } else if (bridgeDescription) {
      rawTurn = { engineRequests: [], narration: bridgeDescription, needsResultBeforeNarrating: false };
    } else {
      const recentRecaps = (await getRecaps(sessionId)).slice(-5);
      // Ground the DM in the table's owned sourcebook (e.g. Storm King's Thunder):
      // retrieve the most relevant official passages and tell the DM to defer to
      // them when in doubt. No-op for adventures without an owned source index.
      // Retrieve source lore using the player's words plus recent narration as
      // context, so vague follow-ups ("what's his name?") inherit the entities
      // from the previous turn instead of missing. The player's input leads;
      // recent narration is lighter context.
      const conversationText = recentRecaps.map((r) => r.narration).join(' ');
      const retrievalQuery = `${playerInput} ${recentRecaps.slice(-2).map((r) => r.narration).join(' ')}`;
      const sourceLore = await buildSourceLoreSection(state.adventureId, retrievalQuery, {
        conversationText,
      });
      if (sourceLore.headings.length > 0 || sourceLore.entities.length > 0) {
        writeDevLog({ type: 'source_lore_injected', sessionId, adventureId: state.adventureId, headings: sourceLore.headings, entities: sourceLore.entities });
      }
      systemPrompt =
        buildSystemPrompt(state) +
        '\nFor a description or information question, answer directly from known or visible facts. Use no engine requests unless the player attempts an action or the answer requires an engine query. A successful check does not move anyone unless movement is separately confirmed.' +
        sourceLore.section +
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
            playerInput: buildDmTurnRepairPrompt(playerInput, validation.issues, state),
          });
          if (aiTurn && !validateDmTurn(aiTurn, state).ok) aiTurn = null;
        }
      }
      const tableRulesTurn = deriveDmTurnFromInput(state, playerInput);
      if (aiTurn) {
        aiUsed = true;
        fallbackUsed = false;
        rawTurn = aiTurn;
      } else {
        aiUsed = false;
        fallbackUsed = true;
        rawTurn = tableRulesTurn;
        if (
          !rawTurn ||
          typeof rawTurn !== 'object' ||
          rawTurn === null ||
          typeof (rawTurn as { narration?: unknown }).narration !== 'string'
        ) {
          rawTurn = {
            engineRequests: [],
            narration:
              'I can work with that, but I need a little more detail. Are you trying to look around, talk to someone, move somewhere, use an item, or inspect a clue?',
            needsResultBeforeNarrating: false,
          };
        }
      }
    }

    const turn = runTurn(state, rawTurn, {
      mode: fallbackUsed ? 'table_rules' : 'ai_director',
      aiUsed,
      fallbackUsed,
      physicalDice: physicalDice || manualRoll !== undefined,
      manualRoll,
    });

    const rollId = turn.pendingTurn ? randomUUID() : undefined;
    if (turn.pendingTurn && rollId) {
      savePendingTurn(sessionId, { rollId, turn: turn.pendingTurn, aiUsed, fallbackUsed, systemPrompt });
    }

    state = turn.state;
    let narration = turn.response.narration;
    if (!turn.response.needsManualRoll && !fallbackUsed && aiUsed && turn.response.needsResultBeforeNarrating && systemPrompt) {
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

    // Self-healing narration: validate against engine truth and re-prompt with the
    // specific contradictions, up to a configurable number of attempts. If the
    // narrator cannot be corrected, fall back to deterministic engine-safe prose so
    // the player never sees a hallucinated outcome.
    let narrationWarnings: string[];
    if (aiUsed && systemPrompt) {
      const healed = await healNarration({
        narration,
        state,
        engineResults: turn.response.engineResults,
        reprompt: (issues) =>
          generateNarration({
            systemPrompt,
            sceneDescription: state.sceneId,
            playerInput,
            originalNarration: narration,
            engineResults: turn.response.engineResults.map((result) => ({
              kind: result.kind,
              summary: result.summary,
              ok: result.ok,
            })),
            visibleState: `Party: ${state.party.map((member) => `${member.name} (${member.hp}/${member.maxHp})`).join('; ')}.`,
            validationIssues: issues,
          }),
      });
      narration = healed.narration;
      narrationWarnings = healed.warnings;
      if (healed.attempts > 0) {
        writeDevLog({
          type: 'narration_self_heal',
          sessionId,
          attempts: healed.attempts,
          usedEngineSafeFallback: healed.usedEngineSafeFallback,
        });
      }
    } else if (bridgeDescription) {
      narrationWarnings = [];
    } else {
      narrationWarnings = detectNarrationWarnings(narration, state, turn.response.engineResults);
      if (narrationWarnings.length > 0) {
        narration = buildEngineSafeNarration(turn.response.engineResults);
      }
    }

    // Periodic Canon Log Summarization.
    if (state.canonLog.length >= 20) {
      const summarized = await summarizeCanonLog(state.canonLog);
      state = { ...state, canonLog: summarized };
    }
    // Deterministic pruning bounds canon-log growth over a long campaign.
    state = { ...state, canonLog: pruneCanonLog(state.canonLog) };

    await saveSession(state);
    const turnNumber = nextTurnNumber(sessionId);

    narration = fallbackUsed && shouldUseMockFlavorPrefix()
      ? `The wind shifts and the tale steadies itself. ${narration}`
      : narration;

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
    await saveRecap(sessionId, recap);

    const response = {
      ...turn.response,
      narration,
      narrationWarnings,
      rollId,
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
