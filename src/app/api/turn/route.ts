import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { shouldUseMockFlavorPrefix } from '@/lib/llm/credentials';
import {
  createLlmAttemptBudget,
  generateDmTurn,
  generateNarration,
  withLlmAttemptBudget,
} from '@/lib/llm/provider';
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
  claimSessionRequest,
  getOrCreateSession,
  getRecaps,
  getSession,
  getTurnCount,
  nextTurnNumber,
  releaseSessionRequest,
  saveRecap,
  saveSession,
} from '@/lib/orchestrator/session-store';
import { writeDevLog } from '@/lib/logging/dev-log';
import { clientIp, consumeRateLimit, sameOrigin, validRequestId } from '@/lib/http/request-guard';
import { isSecureSessionId } from '@/lib/security/session-id';
import { isSessionAuthorized, requiresSessionAccess } from '@/lib/security/session-access';
import type { GameState } from '@/lib/game/types';

const TURN_LOCK_MS = 120_000;
const LEGACY_RETRY_WINDOW_MS = 15_000;

type PendingEnvelope = { rawTurn: unknown; aiUsed: boolean; fallbackUsed: boolean };

function isPendingEnvelope(value: unknown): value is PendingEnvelope {
  return !!value && typeof value === 'object' && 'rawTurn' in value &&
    typeof (value as PendingEnvelope).aiUsed === 'boolean' &&
    typeof (value as PendingEnvelope).fallbackUsed === 'boolean';
}

async function buildTurnPrompt(state: GameState, playerInput: string, sessionId: string): Promise<string> {
  const recentRecaps = (await getRecaps(sessionId)).slice(-5);
  const conversationText = recentRecaps.map((r) => r.narration).join(' ');
  const retrievalQuery = `${playerInput} ${recentRecaps.slice(-2).map((r) => r.narration).join(' ')}`;
  const sourceLore = await buildSourceLoreSection(state.adventureId, retrievalQuery, { conversationText });
  if (sourceLore.headings.length > 0 || sourceLore.entities.length > 0) {
    writeDevLog({
      type: 'source_lore_injected',
      sessionId,
      adventureId: state.adventureId,
      headingCount: sourceLore.headings.length,
      entityCount: sourceLore.entities.length,
    });
  }
  return buildSystemPrompt(state) + sourceLore.section +
    (recentRecaps.length > 0
      ? `\n\n## RECENT CONVERSATION HISTORY\n${recentRecaps.map((r) => `Turn ${r.turnNumber} Narration: ${r.narration}`).join('\n')}`
      : '');
}

function publicSessionId(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  if (process.env.NODE_ENV === 'production' && !isSecureSessionId(value)) return null;
  return value.slice(0, 128);
}

function implicitRequestId(body: Record<string, unknown>, sessionId: string): string {
  const fingerprint = JSON.stringify({
    sessionId,
    adventureId: body.adventureId ?? null,
    playerInput: body.playerInput ?? '',
    physicalDice: Boolean(body.physicalDice),
    manualRoll: body.manualRoll ?? null,
  });
  return `legacy-${createHash('sha256').update(fingerprint).digest('hex').slice(0, 32)}`;
}

function canReplayCached(state: GameState, requestId: string, explicitRequestId: boolean): boolean {
  const cached = state.lastTurnResult;
  if (!cached || cached.requestId !== requestId) return false;
  return explicitRequestId || Date.now() - cached.completedAt <= LEGACY_RETRY_WINDOW_MS;
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ ok: false, error: 'Play from this website.' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const sessionId = publicSessionId(body.sessionId);
  if (!sessionId) return NextResponse.json({ ok: false, error: 'Valid sessionId required.' }, { status: 400 });

  const suppliedRequestId = body.requestId;
  if (suppliedRequestId !== undefined && !validRequestId(suppliedRequestId)) {
    return NextResponse.json({ ok: false, error: 'Invalid requestId.' }, { status: 400 });
  }
  const explicitRequestId = validRequestId(suppliedRequestId);
  const requestId = explicitRequestId ? suppliedRequestId : implicitRequestId(body, sessionId);

  const retryAfter = Math.max(
    consumeRateLimit(`turn-ip:${clientIp(req)}`, 60),
    consumeRateLimit(`turn-session:${sessionId}`, 40),
  );
  if (retryAfter) {
    return NextResponse.json(
      { ok: false, error: 'Too many turns at once. Please try again shortly.', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  const requestedAdventureId =
    typeof body.adventureId === 'string' && isValidAdventureId(body.adventureId)
      ? body.adventureId
      : undefined;
  const playerInput = typeof body.playerInput === 'string' ? body.playerInput.slice(0, 800) : '';
  const manualRoll = typeof body.manualRoll === 'number' ? body.manualRoll : undefined;
  const physicalDice = Boolean(body.physicalDice);
  if (!playerInput.trim() && manualRoll === undefined) {
    return NextResponse.json({ ok: false, error: 'playerInput required.' }, { status: 400 });
  }
  if (body.manualRoll !== undefined) {
    const manualRollError = validateManualD20Roll(body.manualRoll);
    if (manualRollError) return NextResponse.json({ ok: false, error: manualRollError }, { status: 400 });
  }

  let existing = await getSession(sessionId);
  // Preserve internal tests that deliberately exercise getOrCreate behavior, but
  // never let the production API create a campaign from an arbitrary identifier.
  if (!existing && process.env.NODE_ENV !== 'production' && !requiresSessionAccess()) {
    existing = await getOrCreateSession(sessionId);
  }
  if (!existing) return NextResponse.json({ ok: false, error: 'Session not found.' }, { status: 404 });
  if (requiresSessionAccess() && !isSessionAuthorized(req, existing)) {
    return NextResponse.json({ ok: false, error: 'Session access denied.' }, { status: 403 });
  }
  if (canReplayCached(existing, requestId, explicitRequestId)) {
    return NextResponse.json(existing.lastTurnResult!.response);
  }
  if (requestedAdventureId && existing.adventureId !== requestedAdventureId) {
    return NextResponse.json({ ok: false, error: 'This session belongs to a different adventure. Start a new game to switch adventures.' }, { status: 409 });
  }

  const configuredMaxTurns = Number(process.env.PARTYQUEST_MAX_TURNS_PER_SESSION ?? 0);
  const maxTurns = Number.isFinite(configuredMaxTurns) && configuredMaxTurns > 0 ? Math.floor(configuredMaxTurns) : 0;
  if (maxTurns > 0 && getTurnCount(sessionId) >= maxTurns) {
    return NextResponse.json({ ok: false, sessionId, error: `This session has reached its ${maxTurns}-turn limit.` }, { status: 429 });
  }

  const claimedState = await claimSessionRequest(sessionId, requestId, TURN_LOCK_MS);
  if (!claimedState) {
    return NextResponse.json({ ok: false, sessionId, error: 'A turn is already being resolved for this campaign.' }, { status: 409 });
  }
  let state: GameState = claimedState;
  if (canReplayCached(state, requestId, explicitRequestId)) {
    const cached = state.lastTurnResult!.response;
    await releaseSessionRequest(sessionId, requestId);
    return NextResponse.json(cached);
  }

  const budget = createLlmAttemptBudget();
  try {
    return await withLlmAttemptBudget(budget, async () => {
      let rawTurn: unknown;
      let aiUsed = false;
      let fallbackUsed = false;
      let turnInput = playerInput;
      let systemPrompt = '';

      const pending = state.pendingDmTurn;
      if (pending && manualRoll === undefined) {
        await releaseSessionRequest(sessionId, requestId);
        return NextResponse.json({ ok: false, sessionId, error: 'Finish the pending physical-dice roll before taking another action.' }, { status: 409 });
      }
      if (manualRoll !== undefined && !pending) {
        await releaseSessionRequest(sessionId, requestId);
        return NextResponse.json({ ok: false, sessionId, error: 'There is no pending physical-dice roll for this session.' }, { status: 409 });
      }

      if (pending && manualRoll !== undefined) {
        const envelope = isPendingEnvelope(pending.turn)
          ? pending.turn
          : { rawTurn: pending.turn, aiUsed: false, fallbackUsed: true };
        rawTurn = envelope.rawTurn;
        aiUsed = envelope.aiUsed;
        fallbackUsed = envelope.fallbackUsed;
        turnInput = pending.playerInput || playerInput;
        state = { ...state };
        delete state.pendingDmTurn;
        if (aiUsed) systemPrompt = await buildTurnPrompt(state, turnInput, sessionId);
      } else {
        systemPrompt = await buildTurnPrompt(state, turnInput, sessionId);
        let aiTurn = await generateDmTurn({ systemPrompt, playerInput: turnInput });
        if (aiTurn) {
          const validation = validateDmTurn(aiTurn, state);
          if (!validation.ok) {
            writeDevLog({ type: 'dm_turn_validation', sessionId, issueCount: validation.issues.length });
            aiTurn = await generateDmTurn({
              systemPrompt,
              playerInput: buildDmTurnRepairPrompt(turnInput, validation.issues, state),
            });
            if (aiTurn && !validateDmTurn(aiTurn, state).ok) aiTurn = null;
          }
        }
        const tableRulesTurn = deriveDmTurnFromInput(state, turnInput);
        if (aiTurn) {
          aiUsed = true;
          rawTurn = aiTurn;
        } else {
          fallbackUsed = true;
          rawTurn = tableRulesTurn;
          if (!rawTurn || typeof rawTurn !== 'object' || typeof (rawTurn as { narration?: unknown }).narration !== 'string') {
            rawTurn = {
              engineRequests: [],
              narration: 'I can work with that, but I need a little more detail. Are you trying to look around, talk to someone, move somewhere, use an item, or inspect a clue?',
              needsResultBeforeNarrating: false,
            };
          }
        }
      }

      const turn = runTurn(state, rawTurn, {
        mode: fallbackUsed ? 'table_rules' : 'ai_director',
        aiUsed,
        fallbackUsed,
        physicalDice,
        manualRoll,
      });
      state = turn.state;
      if (turn.response.needsManualRoll) {
        state = {
          ...state,
          pendingDmTurn: {
            turn: { rawTurn, aiUsed, fallbackUsed },
            playerInput: turnInput,
            createdAt: Date.now(),
          },
        };
      } else if (state.pendingDmTurn) {
        state = { ...state };
        delete state.pendingDmTurn;
      }

      let narration = turn.response.narration;
      if (!fallbackUsed && aiUsed && turn.response.needsResultBeforeNarrating && systemPrompt && !turn.response.needsManualRoll) {
        const visibleState = `Party: ${state.party.map((p) => `${p.name} (${p.hp}/${p.maxHp})`).join('; ')}.`;
        const narrationRewrite = await generateNarration({
          systemPrompt,
          sceneDescription: state.sceneId,
          playerInput: turnInput,
          originalNarration: narration,
          engineResults: turn.response.engineResults.map((r) => ({ kind: r.kind, summary: r.summary, ok: r.ok })),
          visibleState,
        });
        if (narrationRewrite) narration = narrationRewrite;
      }

      let narrationWarnings: string[];
      if (aiUsed && systemPrompt && !turn.response.needsManualRoll) {
        const healed = await healNarration({
          narration,
          state,
          engineResults: turn.response.engineResults,
          reprompt: (issues) => generateNarration({
            systemPrompt,
            sceneDescription: state.sceneId,
            playerInput: turnInput,
            originalNarration: narration,
            engineResults: turn.response.engineResults.map((result) => ({ kind: result.kind, summary: result.summary, ok: result.ok })),
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
      } else {
        narrationWarnings = detectNarrationWarnings(narration, state, turn.response.engineResults);
        if (narrationWarnings.length > 0) narration = buildEngineSafeNarration(turn.response.engineResults);
      }

      if (!turn.response.needsManualRoll && state.canonLog.length >= 20) {
        const summarized = await summarizeCanonLog(state.canonLog);
        state = { ...state, canonLog: summarized };
      }
      state = { ...state, canonLog: pruneCanonLog(state.canonLog) };

      narration = fallbackUsed && shouldUseMockFlavorPrefix()
        ? `The wind shifts and the tale steadies itself. ${narration}`
        : narration;

      if (narrationWarnings.length > 0) {
        writeDevLog({ type: 'narration_validation', sessionId, warningCount: narrationWarnings.length });
      }

      const turnNumber = nextTurnNumber(sessionId);
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

      const response = {
        ...turn.response,
        narration,
        narrationWarnings,
        sessionId,
        recap,
      };
      const completedState: GameState = {
        ...state,
        lastTurnResult: { requestId, response, completedAt: Date.now() },
      };
      delete completedState.activeRequest;
      await saveSession(completedState);
      await saveRecap(sessionId, recap);

      writeDevLog({
        type: 'turn',
        sessionId,
        requestId,
        inputLength: turnInput.length,
        mode: turn.response.mode,
        llmAttempts: budget.used,
        engineRequestKinds: turn.response.engineResults.map((result) => result.kind),
        warningCount: narrationWarnings.length,
      });
      return NextResponse.json(response);
    });
  } catch (error) {
    await releaseSessionRequest(sessionId, requestId);
    writeDevLog({
      type: 'turn_error',
      sessionId,
      requestId,
      inputLength: playerInput.length,
      errorClass: error instanceof Error ? error.name : 'UnknownError',
      llmAttempts: budget.used,
    });
    return NextResponse.json(
      { ok: false, sessionId, error: 'Turn processing failed. Please try that action again.' },
      { status: 500 },
    );
  }
}
