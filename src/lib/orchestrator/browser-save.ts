import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import type { GameState } from '@/lib/game/types';
import type { PartyQuestRecap } from '@/lib/game/recap';
import type { PendingTurn } from './session-store';

type BrowserSave = {
  state: GameState;
  recaps: PartyQuestRecap[];
  turnNumber: number;
  pending?: PendingTurn;
};

const maxTokenLength = 512_000;
const purpose = 'partyquest-browser-save-v1';

function key(): Buffer | undefined {
  const secret = process.env.PARTYQUEST_BROWSER_SAVE_SECRET?.trim() || process.env.DATABASE_URL?.trim();
  if (!secret) return;
  return Buffer.from(hkdfSync('sha256', secret, '', purpose, 32));
}

export function sealBrowserSave(save: BrowserSave): string | undefined {
  const secret = key();
  if (!secret) return;
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secret, nonce);
  cipher.setAAD(Buffer.from(save.state.sessionId));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(save), 'utf8'), cipher.final()]);
  const token = Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString('base64url');
  if (token.length <= maxTokenLength) return token;
}

export function openBrowserSave(token: unknown, sessionId: string): BrowserSave | undefined {
  const secret = key();
  if (!secret || typeof token !== 'string' || token.length > maxTokenLength) return;
  try {
    const bytes = Buffer.from(token, 'base64url');
    const cipher = createDecipheriv('aes-256-gcm', secret, bytes.subarray(0, 12));
    cipher.setAAD(Buffer.from(sessionId));
    cipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8')) as BrowserSave;
  } catch {
    return;
  }
}
