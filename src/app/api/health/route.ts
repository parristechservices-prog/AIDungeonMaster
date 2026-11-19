import { NextResponse } from 'next/server';
import { hasLlmCredentials } from '@/lib/llm/credentials';
import { getConfiguredProviders, getProviderKeyCounts } from '@/lib/llm/credentials';
import { ACTIVE_PROMPT_VERSION } from '@/lib/llm/prompts/active';
import { getSessionStorageMode } from '@/lib/orchestrator/session-store';

import { getDb } from '@/lib/db/client';
import { loadSourceForAdventure } from '@/lib/llm/source-lore/store.server';

async function checkStorage() {
  const db = getDb();
  if (!db) return 'memory';
  try {
    await db`select session_id, state, updated_at from sessions limit 0`;
    await db`select session_id, recap, id from recaps limit 0`;
    return 'reachable';
  } catch (error) {
    console.error('Persistence health check failed', error);
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    if (code === '42P01' || code === '42703') return 'schema-unavailable';
    if (code === '42501' || code === '28P01' || code === '28000') return 'access-denied';
    return 'unreachable';
  }
}

export async function GET(request: Request) {
  const inspectSource = new URL(request.url).searchParams.get('source') === 'skt';
  const source = inspectSource ? await loadSourceForAdventure('skt-nightstone-chapter1') : null;
  const inspectStorage = new URL(request.url).searchParams.get('storage') === 'check';
  const storageStatus = inspectStorage ? await checkStorage() : undefined;
  return NextResponse.json({
    ok: true,
    service: 'partyquest',
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
    forcedMock: (process.env.PARTYQUEST_FORCE_MOCK ?? '').toLowerCase() === 'true',
    llmConfigured: hasLlmCredentials(),
    configuredProviders: getConfiguredProviders(),
    providerKeyCounts: getProviderKeyCounts(),
    storageMode: getSessionStorageMode(),
    storageStatus,
    promptVersion: ACTIVE_PROMPT_VERSION,
    ...(inspectSource && {
      sktSource: {
        configured: Boolean(process.env.SKT_SOURCE_BLOB_URL?.trim()),
        loaded: Boolean(source),
        passages: source?.index.chunks.length ?? 0,
        indexedEntities: source?.index.gazetteer?.length ?? 0,
      },
    }),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
