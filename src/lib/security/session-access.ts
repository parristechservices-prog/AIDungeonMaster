import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { GameState } from '@/lib/game/types';

export const SESSION_ACCESS_COOKIE = 'partyquest-session-access';
const SESSION_ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function issueSessionAccess(sessionId: string): { token: string; hash: string; cookieValue: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashAccessToken(token), cookieValue: `${sessionId}.${token}` };
}

export function sessionAccessCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_ACCESS_MAX_AGE_SECONDS,
  };
}

export function isSessionAuthorized(req: Request, state: GameState): boolean {
  if (!requiresSessionAccess()) return true;
  if (!state.sessionAccessHash) return false;
  const raw = readCookie(req.headers.get('cookie'), SESSION_ACCESS_COOKIE);
  if (!raw) return false;
  const separator = raw.indexOf('.');
  if (separator < 1) return false;
  const sessionId = raw.slice(0, separator);
  const token = raw.slice(separator + 1);
  if (sessionId !== state.sessionId || !token) return false;
  return safeEqual(hashAccessToken(token), state.sessionAccessHash);
}

export function requiresSessionAccess(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.PARTYQUEST_REQUIRE_SESSION_ACCESS === 'true';
}

export function hashAccessToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
