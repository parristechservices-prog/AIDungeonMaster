import { NextResponse } from 'next/server';
import { hasLlmCredentials } from '@/lib/llm/credentials';
import { ACTIVE_PROMPT_VERSION } from '@/lib/llm/prompts/active';
import { getSessionStorageMode } from '@/lib/orchestrator/session-store';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'partyquest',
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
    llmConfigured: hasLlmCredentials(),
    storageMode: getSessionStorageMode(),
    promptVersion: ACTIVE_PROMPT_VERSION,
  });
}
