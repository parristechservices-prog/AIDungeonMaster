import { NextResponse } from 'next/server';
import { getLatestRecap } from '@/lib/orchestrator/session-store';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId') ?? 'local-default';
  const recap = await getLatestRecap(sessionId);
  if (!recap) return NextResponse.json({ ok: false, error: 'No recap found' }, { status: 404 });
  return NextResponse.json({ ok: true, recap });
}
