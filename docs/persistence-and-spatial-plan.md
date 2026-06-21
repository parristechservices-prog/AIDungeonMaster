# Persistence + Spatial Tracking — Implementation Plan

## 2026-06-21 Spatial Awareness Package Intake

The imported AIDM Spatial Awareness package converges on one strong rule:
the LLM should propose spatial intent, but deterministic engine code must own
movement legality, area reachability, terrain cost, combat distance, and any
result the narration is allowed to claim.

Consensus build order from the package:

1. Area graph / zone movement first for exploration: named areas, exits,
   actor locations, blocked/gated connections, and query requests.
2. Square-grid tactical combat second: 5-foot cells, configurable diagonal
   mode, terrain costs, occupied/blocked cells, movement budget, Dash,
   Disengage, reach, and opportunity-attack triggers.
3. Line of sight, cover, AoE templates, verticality/falling, and hex adapters
   come after basic tactical movement is solid.
4. Narration validation must be extended so prose cannot imply a move, melee
   reach, line of sight, or arrival that the engine did not grant.

### Shipped in the first intake pass

- Added `src/lib/engine/spatial/` with pure area graph types and functions:
  `createExplorationState`, `canMove`, `moveActor`, `actorsInSameArea`, and
  `findPath`.
- Added structured spatial engine requests:
  `move_area`, `query_current_area`, `query_exits`, `query_actors_present`,
  and `query_path_exists`.
- Extended the main `EngineRequest` contract, LLM schema, prompt request list,
  `GameState`, and turn response shape so sessions can carry optional
  `exploration` state.
- Added Vitest coverage for the area graph and a main-engine movement smoke
  test.

### Next roadmap slice: make exploration spatial data real

- Add an `areas`/`exploration` authoring field to module schemas and content
  templates, then validate malformed area graphs during module import.
- Author the Nightstone area graph and seed `GameState.exploration` when an
  adventure provides an area graph.
- Compute `satisfiedTags` from inventory, canon flags, and resolved checks so
  `requires: { tag }` gates work for locked doors, repaired bridges, secret
  routes, and skill-gated transitions.
- Filter prompt spatial context to current area plus adjacent areas only. The
  prompt now supports this when exploration state exists; the remaining work is
  feeding it real module data.
- Add narration drift checks for failed `move_area` results and for prose that
  claims arrival in a non-current area.

### Next roadmap slice: tactical movement

- Extend `CombatState.grid` into a battle map with cells, terrain tags,
  blocked/sight-blocking flags, actor size, reach, speed, movement spent,
  action state, reaction availability, and configurable diagonal movement.
- Add requests for `query_reachable`, `move_combat`, `dash`, `disengage`, and
  `query_targets_in_range`.
- Use Dijkstra/A* path costs for movement: normal 5 ft cells, difficult terrain
  costing extra, occupied spaces, blocked cells, prone/crawling, Dash, and
  hostile reach.
- Surface engine-computed answers to the LLM rather than asking it to calculate
  distance, line of sight, cover, or AoE legality.

---

Concrete, file-scoped plan for the two production-architecture gaps (roadmap #1 and
#2). Both are contained patches, not rebuilds — the engine-validates / LLM-narrates
bones are already right. Run `pnpm test` / `pnpm build` after each phase.

---

## Gap 1 — Persistence (state tracker, roadmap #2)

**Status: DONE.** Postgres-backed sessions/recaps, `src/lib/db/client.ts`,
`scripts/db-migrate.ts`, and the `postgres` dependency are already present.
Keep this section as historical implementation context.

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

**Status: moved to the active spatial roadmap.** See
[`spatial-awareness-roadmap.md`](spatial-awareness-roadmap.md) for the current
multi-phase plan and Phase 1 status.

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
