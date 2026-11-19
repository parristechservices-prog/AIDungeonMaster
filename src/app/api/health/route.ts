import { NextResponse } from 'next/server';
import { hasLlmCredentials } from '@/lib/llm/credentials';
import { getConfiguredProviders, getProviderKeyCounts } from '@/lib/llm/credentials';
import { ACTIVE_PROMPT_VERSION } from '@/lib/llm/prompts/active';
import { getSessionStorageMode } from '@/lib/orchestrator/session-store';

import { loadSourceForAdventure } from '@/lib/llm/source-lore/store.server';

export async function GET(request?: Request) {
  const inspectSource = request ? new URL(request.url).searchParams.get('source') === 'skt' : false;
  const source = inspectSource ? await loadSourceForAdventure('skt-nightstone-chapter1') : null;
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
