import { NextResponse } from 'next/server';
import { getLatestRecap, getSession } from '@/lib/orchestrator/session-store';
import { clientIp, consumeRateLimit, sameOrigin } from '@/lib/http/request-guard';
import { isSecureSessionId } from '@/lib/security/session-id';
import { isSessionAuthorized, requiresSessionAccess } from '@/lib/security/session-access';

export async function GET(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, error: 'Read recaps from this website.' }, { status: 403 });
  const retryAfter = consumeRateLimit(`recap-read:${clientIp(req)}`, 60);
  if (retryAfter) {
    return NextResponse.json(
      { ok: false, error: 'Too many recap requests. Please try again shortly.', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId || (process.env.NODE_ENV === 'production' && !isSecureSessionId(sessionId))) {
    return NextResponse.json({ ok: false, error: 'Valid sessionId required' }, { status: 400 });
  }
  const state = await getSession(sessionId);
  if (!state) return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 });
  if (requiresSessionAccess() && !isSessionAuthorized(req, state)) {
    return NextResponse.json({ ok: false, error: 'Session access denied' }, { status: 403 });
  }

  const recap = await getLatestRecap(sessionId);
  if (!recap) return NextResponse.json({ ok: false, error: 'No recap found' }, { status: 404 });
  return NextResponse.json({ ok: true, recap });
}
