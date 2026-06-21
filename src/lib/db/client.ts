import postgres from 'postgres';

/**
 * Single shared Postgres client for the app.
 *
 * Uses Supabase's transaction-mode pooler (port 6543). `prepare: false` is
 * REQUIRED there: transaction pooling does not support prepared statements, so
 * leaving it on causes "prepared statement does not exist" errors under load.
 *
 * Returns null when DATABASE_URL is unset so callers can fall back to in-memory
 * storage (local dev without a DB, tests, etc.).
 */
let client: ReturnType<typeof postgres> | null | undefined;

export function getDb(): ReturnType<typeof postgres> | null {
  if (client !== undefined) return client;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    client = null;
    return client;
  }
  client = postgres(url, {
    prepare: false,
    // Keep the serverless footprint small; the pooler multiplexes connections.
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return client;
}

export function hasDb(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}
