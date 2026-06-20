# Persistence + Spatial Tracking — Implementation Plan

Concrete, file-scoped plan for the two production-architecture gaps (roadmap #1 and
#2). Both are contained patches, not rebuilds — the engine-validates / LLM-narrates
bones are already right. Run `pnpm test` / `pnpm build` after each phase.

---

## Gap 1 — Persistence (state tracker, roadmap #2)

**Reality check.** Retrieval is fine: `src/lib/llm/source-lore/retrieve.ts` does
TF-IDF over chunked book text with a gazetteer of named entities, heading-boosted.
For a fixed module (SKT) this *outperforms* a vector DB for named-entity precision
("Sydiri Haunlar" reliably pulls the Sydiri Haunlar chunk; embeddings can fuzzy-match
the wrong NPC). We likely don't need Pinecone.

**The real gap is persistence.** `session-store.ts` keeps `GameState` in an in-memory
`Map`, written to `.data/session-{id}.json` only off-Vercel. On Vercel it's lost when
the serverless instance recycles. Fix = swap the I/O backend, keep the interface.

### Task A — Schema (`src/lib/db/schema.sql`)
```sql
create table if not exists sessions (
  session_id text primary key,
  state jsonb not null,
  updated_at timestamptz default now()
);
create table if not exists recaps (
  id serial primary key,
  session_id text references sessions(session_id) on delete cascade,
  recap jsonb not null,
  created_at timestamptz default now()
);
create index if not exists recaps_session_idx on recaps(session_id);
```
Add a `pnpm db:migrate` script that runs this against `DATABASE_URL`.

### Task B — Rewrite `src/lib/orchestrator/session-store.ts`
- Keep every exported signature identical: `startNewGame`, `getOrCreateSession`,
  `saveSession`, `nextTurnNumber`, `getTurnCount`, `getSessionStorageMode`,
  `saveRecap`, `getRecaps`, `getLatestRecap`, `savePendingTurn`, `getPendingTurn`,
  `clearPendingTurn`.
- Replace the `fs.existsSync`/`writeFileSync`/`readFileSync` blocks with `sql`
  queries via a new shared client `src/lib/db/client.ts` (single `postgres()` instance).
- Keep the in-memory `Map<string, GameState>` as a read-through cache: check map →
  fall back to DB `select` → populate map on hit.
- `saveSession` uses `INSERT ... ON CONFLICT (session_id) DO UPDATE`.
- `turnCounters` and `pendingTurns` stay in-memory only (per-active-request).
- `getSessionStorageMode()` returns `'postgres'`.
- Delete the `IS_VERCEL` branching — DB works the same everywhere.

### Task C — Canon-log pruning (`src/lib/llm/summarizer.ts`)
Add `pruneCanonLog(canonLog: CanonFact[], turnNumber: number): CanonFact[]`:
- Always keep all `importance: 'high'` facts.
- For `medium`, keep the most recent N (~40).
- For `low`, drop anything older than M turns (~10), or fold into a rolling-summary
  string before dropping.
Call it from `run-turn.ts` right after a turn resolves, before `saveSession`.

### Task D — Tests
- Add `session-store.test.ts` mocking the `postgres` client; verify round-trip
  save/load matches the prior shape.
- `pnpm test` — all existing engine/narration tests must pass unchanged (pure I/O swap).

---

## Gap 2 — Area graph / spatial tracking (spatial model, roadmap #1)

**Reality check.** `CombatState.grid` (`game/types.ts`) already has
`width`/`height`/`positions: Record<actorId,{x,y}>`, but only for one combat. There's
no persistent overworld — `GameState.sceneId` is a 4-state machine, not a map.

### Task A — Types (`src/lib/game/types.ts`)
```ts
export type AreaId = string;
export type Area = {
  id: AreaId;
  name: string;            // "Temple (Area 5)"
  connections: AreaId[];   // adjacent area ids
  npcsPresent: string[];   // NPC ids currently here
  monstersPresent?: string[];
  notes?: string;
};
// in GameState:
currentAreaId: AreaId;
areas: Record<AreaId, Area>;
```
Update `createInitialState` (`game/state.ts`) to default `currentAreaId`/`areas`, and
`migrateGameState` to backfill them for old saves (same pattern as `npcs`/`canonLog`).

### Task B — Author the Nightstone map
Create `src/lib/game/adventures/skt-nightstone/areas.ts` with ~15 `Area` entries
matching the Nightstone map key (gatehouse, drawbridge, temple/bell tower, general
store, inn, stable, windmill, Nandar Keep gate, great hall, etc.) with correct
`connections`. One-time data entry, not new infrastructure.

### Task C — Movement validation (`src/lib/orchestrator/run-turn.ts`)
- New engine request `{ type: 'move', targetAreaId: string }`.
- Before applying, check `state.areas[state.currentAreaId].connections.includes(targetAreaId)`.
- Invalid → don't move; return `{ type:'move', success:false, reason:'no_path' }` for the
  LLM to narrate as "you can't get there directly from here" (no teleporting).
- Valid → update `currentAreaId`, update `npcsPresent` if NPCs follow/flee.
- Route it through the same `validate-dm-turn.ts` step as other engine requests.

### Task D — Scoped prompt injection (`src/lib/llm/system-prompt.ts`)
Inject only `areas[currentAreaId]` plus the `Area` objects for its `connections` — not
the whole map. Mirrors how `selectGazetteer` already scopes NPC injection; keeps token
cost flat regardless of map size.

### Task E — Tests
`movement.test.ts`: move to a connected area succeeds; move to a non-connected area is
rejected with `success:false`; `npcsPresent` updates when an NPC enters/leaves.

---

## Phase 0 — Setup
1. Pick a Postgres provider (Neon free tier or Vercel Postgres). Get the connection string.
2. Add `DATABASE_URL=postgres://...` to `env.example` and `.env.local`.
3. `pnpm add postgres` (lightweight; simpler than `@vercel/postgres` if not Vercel-locked).
4. Create `src/lib/db/client.ts` exporting one shared `postgres()` client.

## Phase 1 — Persistence (Gap 1): Tasks A–D above.
## Phase 2 — Area graph (Gap 2): Tasks A–E above.

## Phase 3 — Wiring & verification
1. `pnpm run module:scaffold -- skt-nightstone-starter skt-nightstone` — confirm the new
   `areas` field appears where expected; update `docs/scenario-authoring.md` if the
   scaffold needs a new template field.
2. `pnpm build && pnpm test` — full pass.
3. Manual smoke test: start a session, move gatehouse → temple → drawbridge, kill the
   server to simulate a Vercel cold start, reload by `sessionId`, confirm state (HP,
   `currentAreaId`, NPCs) is intact from Postgres.

---

**Bottom line:** two isolated, testable phases — (a) one-file I/O swap for persistence,
(b) one new `areas` field plus a validation check in the existing
engine-validates/LLM-narrates loop. The architecture's bones are already right for both.
