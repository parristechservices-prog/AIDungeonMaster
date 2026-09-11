import { createInitialState, migrateGameState } from '@/lib/game/state';
import type { PartyQuestRecap } from '@/lib/game/recap';
import type { GameState, NewGameOptions } from '@/lib/game/types';
import { getDb, hasDb } from '@/lib/db/client';

/**
 * Durable session storage backed by Postgres (Supabase), with an in-memory
 * read-through cache. When DATABASE_URL is unset (tests, local dev without a DB),
 * the in-memory Map is the sole store — same ephemeral behaviour as before, but
 * no filesystem writes.
 *
 * Security-sensitive request state (manual-dice continuation, request locks and
 * the last idempotent response) lives inside GameState so it survives serverless
 * instance changes. The cache is only an optimization, never the source of truth.
 */
const sessions = new Map<string, GameState>();
const turnCounters = new Map<string, number>();
const recapsCache = new Map<string, PartyQuestRecap[]>();

/** Applies legacy field migrations to a loaded state blob, then normalizes it. */
function migrateLoaded(sessionId: string, raw: unknown): GameState {
  const state = raw as Record<string, unknown> & Partial<GameState>;
  const defaults = createInitialState(sessionId);

  if (state.player && !state.party) state.party = [state.player];
  if (state.characterTemplateId && !state.characterTemplateIds) {
    state.characterTemplateIds = [state.characterTemplateId];
  }
  if (!state.player && state.party && state.party.length > 0) state.player = state.party[0];
  if (!state.characterTemplateId && (state.characterTemplateIds?.length ?? 0) > 0) {
    state.characterTemplateId = state.characterTemplateIds![0];
  }
  if (!state.activeCharacterId && state.party && state.party.length > 0) {
    state.activeCharacterId = state.party[0].id;
  }
  if (!state.npcs) state.npcs = defaults.npcs;
  if (!state.canonLog) state.canonLog = defaults.canonLog;

  return migrateGameState(state as GameState);
}

export async function startNewGame(
  sessionId: string,
  options: NewGameOptions,
  sessionAccessHash?: string,
): Promise<GameState> {
  const state = { ...createInitialState(sessionId, options), sessionAccessHash };
  sessions.set(sessionId, state);
  turnCounters.set(sessionId, 0);
  recapsCache.set(sessionId, []);
  await saveSession(state);
  const db = getDb();
  if (db) {
    try {
      await db`delete from recaps where session_id = ${sessionId}`;
    } catch (e) {
      console.warn('Failed to clear recaps for new game', e);
    }
  }
  return state;
}

/** Loads an existing session without creating a new public record on a guessed id. */
export async function getSession(sessionId: string): Promise<GameState | null> {
  if (sessions.has(sessionId)) {
    const cached = migrateGameState(sessions.get(sessionId)!);
    sessions.set(sessionId, cached);
    return cached;
  }

  const db = getDb();
  if (db) {
    try {
      const rows = await db`select state from sessions where session_id = ${sessionId}`;
      if (rows.length > 0) {
        const migrated = migrateLoaded(sessionId, rows[0].state);
        sessions.set(sessionId, migrated);
        // Seed the turn counter from stored recaps so numbering survives a cold start.
        try {
          const counted = await db`select count(*)::int as n from recaps where session_id = ${sessionId}`;
          turnCounters.set(sessionId, counted[0].n);
        } catch {
          // non-fatal; counter defaults to 0
        }
        return migrated;
      }
    } catch (e) {
      console.error('Failed to load session from DB', e);
    }
  }

  return null;
}

/** Internal/dev convenience. Public routes should call getSession and reject misses. */
export async function getOrCreateSession(sessionId: string): Promise<GameState> {
  const existing = await getSession(sessionId);
  if (existing) return existing;
  const next = migrateGameState(createInitialState(sessionId));
  sessions.set(sessionId, next);
  await saveSession(next);
  return next;
}

export async function saveSession(state: GameState): Promise<void> {
  sessions.set(state.sessionId, state);
  const db = getDb();
  if (db) {
    try {
      await db`
        insert into sessions (session_id, state, updated_at)
        values (${state.sessionId}, ${db.json(state as never)}, now())
        on conflict (session_id) do update set state = excluded.state, updated_at = now()`;
    } catch (e) {
      console.warn('Failed to persist session to DB', e);
    }
  }
}

export function nextTurnNumber(sessionId: string): number {
  const next = (turnCounters.get(sessionId) ?? 0) + 1;
  turnCounters.set(sessionId, next);
  return next;
}

export function getTurnCount(sessionId: string): number {
  return turnCounters.get(sessionId) ?? 0;
}

export function getSessionStorageMode(): 'postgres' | 'memory' {
  return hasDb() ? 'postgres' : 'memory';
}

export async function saveRecap(sessionId: string, recap: PartyQuestRecap): Promise<void> {
  const recaps = await getRecaps(sessionId);
  recaps.push(recap);
  recapsCache.set(sessionId, recaps);
  const db = getDb();
  if (db) {
    try {
      await db`insert into recaps (session_id, recap) values (${sessionId}, ${db.json(recap as never)})`;
    } catch (e) {
      console.warn('Failed to persist recap to DB', e);
    }
  }
}

/** @deprecated The turn route now stores pendingDmTurn on GameState directly. */
export async function savePendingTurn(sessionId: string, turn: unknown): Promise<void> {
  const state = await getSession(sessionId);
  if (!state) return;
  await saveSession({ ...state, pendingDmTurn: { turn, playerInput: '', createdAt: Date.now() } });
}

/** @deprecated Read GameState.pendingDmTurn in the turn route. */
export async function getPendingTurn(sessionId: string): Promise<unknown> {
  return (await getSession(sessionId))?.pendingDmTurn?.turn;
}

/** @deprecated Clear GameState.pendingDmTurn in the turn route. */
export async function clearPendingTurn(sessionId: string): Promise<void> {
  const state = await getSession(sessionId);
  if (!state?.pendingDmTurn) return;
  const next = { ...state };
  delete next.pendingDmTurn;
  await saveSession(next);
}

export async function getRecaps(sessionId: string): Promise<PartyQuestRecap[]> {
  if (recapsCache.has(sessionId)) return recapsCache.get(sessionId)!;

  const db = getDb();
  if (db) {
    try {
      const rows = await db`select recap from recaps where session_id = ${sessionId} order by id asc`;
      const recaps = rows.map((r) => r.recap as PartyQuestRecap);
      recapsCache.set(sessionId, recaps);
      return recaps;
    } catch (e) {
      console.error('Failed to load recaps from DB', e);
    }
  }
  return [];
}

export async function getLatestRecap(sessionId: string): Promise<PartyQuestRecap | null> {
  const recaps = await getRecaps(sessionId);
  return recaps.length > 0 ? recaps[recaps.length - 1] : null;
}
