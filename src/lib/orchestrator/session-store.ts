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
 * Postgres is authoritative across server instances. In-memory copies allow an
 * already-loaded session to continue when storage is temporarily unavailable.
 */
const sessions = new Map<string, GameState>();
const durableSessions = new Set<string>();
const turnCounters = new Map<string, number>();
const recapsCache = new Map<string, PartyQuestRecap[]>();
type PendingTurn = {
  rollId: string;
  context: NonNullable<import('./run-turn').TurnResult['manualRollContext']>;
  playerInput: string;
  turn: import('@/lib/llm/contracts').DmTurn; aiUsed: boolean; fallbackUsed: boolean; systemPrompt: string };
const pendingTurns = new Map<string, PendingTurn>();

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

export async function startNewGame(sessionId: string, options: NewGameOptions): Promise<GameState> {
  const state = createInitialState(sessionId, options);
  sessions.set(sessionId, state);
  turnCounters.set(sessionId, 0);
  clearPendingTurn(sessionId);
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

export async function getOrCreateSession(sessionId: string): Promise<GameState> {
  const db = getDb();
  if (db) {
    try {
      const rows = await db`select state from sessions where session_id = ${sessionId}`;
      if (rows.length > 0) {
        const { pendingDice, ...storedState } = rows[0].state as GameState & { pendingDice?: PendingTurn };
        if (pendingDice) pendingTurns.set(sessionId, pendingDice);
        else clearPendingTurn(sessionId);
        const migrated = migrateLoaded(sessionId, storedState);
        sessions.set(sessionId, migrated);
        durableSessions.add(sessionId);
        // Reconcile turn numbering with changes made by other server processes.
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

  if (sessions.has(sessionId)) {
    const cached = migrateGameState(sessions.get(sessionId)!);
    sessions.set(sessionId, cached);
    return cached;
  }

  const next = migrateGameState(createInitialState(sessionId));
  sessions.set(sessionId, next);
  await saveSession(next);
  return next;
}

export async function saveSession(state: GameState, consumedRollId?: string): Promise<boolean> {
  const pendingDice = getPendingTurn(state.sessionId);
  const db = getDb();
  if (db) {
    try {
      if (consumedRollId && durableSessions.has(state.sessionId)) {
        const updated = await db`
          update sessions
          set state = ${db.json({ ...state, pendingDice } as never)}, updated_at = now()
          where session_id = ${state.sessionId} and state->'pendingDice'->>'rollId' = ${consumedRollId}
          returning session_id`;
        if (!updated.length) return false;
      } else {
        await db`
          insert into sessions (session_id, state, updated_at)
          values (${state.sessionId}, ${db.json({ ...state, pendingDice } as never)}, now())
          on conflict (session_id) do update set state = excluded.state, updated_at = now()`;
      }
      durableSessions.add(state.sessionId);
    } catch (e) {
      console.warn('Failed to persist session to DB', e);
      if (consumedRollId && durableSessions.has(state.sessionId)) throw e;
    }
  }
  sessions.set(state.sessionId, state);
  return true;
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

export function savePendingTurn(sessionId: string, turn: PendingTurn): void {
  pendingTurns.set(sessionId, turn);
}

export function getPendingTurn(sessionId: string): PendingTurn | undefined {
  return pendingTurns.get(sessionId);
}

export function clearPendingTurn(sessionId: string): void {
  pendingTurns.delete(sessionId);
}

export async function getRecaps(sessionId: string): Promise<PartyQuestRecap[]> {
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
  return recapsCache.get(sessionId) ?? [];
}

export async function getLatestRecap(sessionId: string): Promise<PartyQuestRecap | null> {
  const recaps = await getRecaps(sessionId);
  return recaps.length > 0 ? recaps[recaps.length - 1] : null;
}
