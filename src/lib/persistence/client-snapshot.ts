import type { TurnResponse } from '@/lib/play/types';

const SNAPSHOT_KEY = 'partyquest-last-turn';

export function saveClientSnapshot(sessionId: string, turn: TurnResponse): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({ sessionId, savedAt: new Date().toISOString(), turn }),
    );
  } catch {
    // Quota or private mode — ignore
  }
}

export function loadClientSnapshot(sessionId: string): TurnResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { sessionId: string; turn: TurnResponse };
    return parsed.sessionId === sessionId ? parsed.turn : null;
  } catch {
    return null;
  }
}

export function clearClientSnapshot(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    // ignore
  }
}
