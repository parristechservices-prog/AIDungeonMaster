import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { writeDevLog } from '@/lib/logging/dev-log';
import { buildIdf } from './retrieve';
import { SOURCE_INDEX_FORMAT, type SourceIndex } from './types';

export type LoadedSource = {
  index: SourceIndex;
  idf: Map<string, number>;
};

/**
 * Maps an adventureId to a source key. All `skt-*` adventures share the
 * Storm King's Thunder source index.
 */
export function sourceKeyForAdventure(adventureId: string): string | null {
  if (adventureId.startsWith('skt-')) return 'skt';
  return null;
}

/** In-memory cache keyed by source key. `null` means "looked, not found". */
const cache = new Map<string, LoadedSource | null>();
const inflight = new Map<string, Promise<LoadedSource | null>>();

function localIndexPath(key: string): string {
  return path.resolve(process.cwd(), 'content', 'private', `${key}-source`, 'index.json');
}

/** Blob URL for a key, e.g. SKT_SOURCE_BLOB_URL. */
function blobUrlForKey(key: string): string | undefined {
  return process.env[`${key.toUpperCase()}_SOURCE_BLOB_URL`]?.trim() || undefined;
}

function validate(raw: unknown, key: string): SourceIndex | null {
  if (!raw || typeof raw !== 'object') return null;
  const idx = raw as Partial<SourceIndex>;
  if (!Array.isArray(idx.chunks) || idx.chunks.length === 0) return null;
  if (idx.builtFormat !== SOURCE_INDEX_FORMAT) {
    writeDevLog({ type: 'source_index_stale', key, gotFormat: idx.builtFormat, want: SOURCE_INDEX_FORMAT });
  }
  return {
    key,
    title: idx.title ?? key,
    builtFormat: idx.builtFormat ?? 0,
    chunks: idx.chunks,
    gazetteer: Array.isArray(idx.gazetteer) ? idx.gazetteer : [],
  };
}

async function loadIndexRaw(key: string): Promise<SourceIndex | null> {
  // Prefer a local private file (dev / self-hosted) for zero-latency, no-network.
  const local = localIndexPath(key);
  if (existsSync(local)) {
    try {
      return validate(JSON.parse(readFileSync(local, 'utf8')), key);
    } catch (e) {
      writeDevLog({ type: 'source_index_local_error', key, error: e instanceof Error ? e.message : 'unknown' });
    }
  }
  // Fall back to Vercel Blob (production).
  const url = blobUrlForKey(key);
  if (url) {
    try {
      const res = await fetch(url, { cache: 'force-cache' });
      if (!res.ok) {
        writeDevLog({ type: 'source_index_blob_error', key, status: res.status });
        return null;
      }
      return validate(await res.json(), key);
    } catch (e) {
      writeDevLog({ type: 'source_index_blob_error', key, error: e instanceof Error ? e.message : 'unknown' });
    }
  }
  return null;
}

/**
 * Load (and cache) the source index for an adventure, or null if no owned
 * source is configured. Concurrent callers share one in-flight load.
 */
export async function loadSourceForAdventure(adventureId: string): Promise<LoadedSource | null> {
  const key = sourceKeyForAdventure(adventureId);
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;
  if (inflight.has(key)) return inflight.get(key)!;

  const promise = (async () => {
    const index = await loadIndexRaw(key);
    const loaded = index ? { index, idf: buildIdf(index) } : null;
    cache.set(key, loaded);
    inflight.delete(key);
    return loaded;
  })();
  inflight.set(key, promise);
  return promise;
}

/** Test/dev helper to clear the cache. */
export function __clearSourceCache() {
  cache.clear();
  inflight.clear();
}
