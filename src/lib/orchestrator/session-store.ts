import { createInitialState, migrateGameState } from '@/lib/game/state';
import type { PartyQuestRecap } from '@/lib/game/recap';
import type { GameState, NewGameOptions } from '@/lib/game/types';
import fs from 'fs';
import path from 'path';

const STORAGE_DIR = path.join(process.cwd(), '.data');
const IS_VERCEL = process.env.VERCEL === '1';

// Only try to create directory if not on Vercel
if (!IS_VERCEL) {
  try {
    if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
  } catch (e) {
    console.warn('Could not create storage directory, persistence disabled.', e);
  }
}

const sessions = new Map<string, GameState>();
const turnCounters = new Map<string, number>();
const latestRecaps = new Map<string, PartyQuestRecap[]>();

function getSessionPath(sessionId: string) { return path.join(STORAGE_DIR, `session-${sessionId}.json`); }
function getRecapsPath(sessionId: string) { return path.join(STORAGE_DIR, `recaps-${sessionId}.json`); }

export function startNewGame(sessionId: string, options: NewGameOptions): GameState {
  const state = createInitialState(sessionId, options);
  sessions.set(sessionId, state);
  turnCounters.set(sessionId, 0);
  latestRecaps.set(sessionId, []);
  saveSession(state);
  if (!IS_VERCEL) {
    try {
      const recapsPath = getRecapsPath(sessionId);
      if (fs.existsSync(recapsPath)) fs.unlinkSync(recapsPath);
    } catch {
      // ignore
    }
  }
  return state;
}

export function getOrCreateSession(sessionId: string): GameState {
  if (sessions.has(sessionId)) {
    const cached = migrateGameState(sessions.get(sessionId)!);
    sessions.set(sessionId, cached);
    return cached;
  }
  
  if (!IS_VERCEL) {
    const filePath = getSessionPath(sessionId);
    if (fs.existsSync(filePath)) {
      try {
        const state = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        
        // Migration: Ensure new fields exist in loaded state
        const defaults = createInitialState(sessionId);
        if (state.player && state.player.gold === undefined) state.player.gold = defaults.player.gold;
        if (state.player && !state.player.inventory) state.player.inventory = defaults.player.inventory;
        if (!state.npcs) state.npcs = defaults.npcs;
        if (!state.canonLog) state.canonLog = defaults.canonLog;

        const migrated = migrateGameState(state as import('@/lib/game/types').GameState);
        sessions.set(sessionId, migrated);
        return migrated;
      } catch (e) { console.error('Failed to load session', e); }
    }
  }

  const next = migrateGameState(createInitialState(sessionId));
  saveSession(next);
  return next;
}

export function saveSession(state: GameState): void {
  sessions.set(state.sessionId, state);
  if (!IS_VERCEL) {
    try {
      fs.writeFileSync(getSessionPath(state.sessionId), JSON.stringify(state, null, 2));
    } catch (e) {
      console.warn('Failed to persist session to disk', e);
    }
  }
}

export function nextTurnNumber(sessionId: string): number {
  const current = turnCounters.get(sessionId) ?? 0;
  const next = current + 1;
  turnCounters.set(sessionId, next);
  return next;
}

export function saveRecap(sessionId: string, recap: PartyQuestRecap): void {
  const recaps = getRecaps(sessionId);
  recaps.push(recap);
  latestRecaps.set(sessionId, recaps);
  if (!IS_VERCEL) {
    try {
      fs.writeFileSync(getRecapsPath(sessionId), JSON.stringify(recaps, null, 2));
    } catch (e) {
      console.warn('Failed to persist recaps to disk', e);
    }
  }
}

export function getRecaps(sessionId: string): PartyQuestRecap[] {
  if (latestRecaps.has(sessionId)) return latestRecaps.get(sessionId)!;

  if (!IS_VERCEL) {
    const filePath = getRecapsPath(sessionId);
    if (fs.existsSync(filePath)) {
      try {
        const recaps = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        latestRecaps.set(sessionId, recaps);
        return recaps;
      } catch (e) { console.error('Failed to load recaps', e); }
    }
  }
  return [];
}

export function getLatestRecap(sessionId: string): PartyQuestRecap | null {
  const recaps = getRecaps(sessionId);
  return recaps.length > 0 ? recaps[recaps.length - 1] : null;
}
