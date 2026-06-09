import { NextResponse } from 'next/server';
import { hasLlmCredentials } from '@/lib/llm/credentials';
import { getConfiguredProviders, getProviderKeyCounts } from '@/lib/llm/credentials';
import { ACTIVE_PROMPT_VERSION } from '@/lib/llm/prompts/active';
import { getSessionStorageMode } from '@/lib/orchestrator/session-store';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'partyquest',
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
    forcedMock: (process.env.PARTYQUEST_FORCE_MOCK ?? '').toLowerCase() === 'true',
    llmConfigured: hasLlmCredentials(),
    configuredProviders: getConfiguredProviders(),
    providerKeyCounts: getProviderKeyCounts(),
    storageMode: getSessionStorageMode(),
    promptVersion: ACTIVE_PROMPT_VERSION,
  });
}
