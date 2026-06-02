---
doc: Published adventures — implementation plan
project: PartyQuest / AIDungeonMaster
date: 2026-06-02
status: in progress
companions: published-adventures-guide.md
---

# Published adventures — implementation plan

Tracks engineering work to support **owned** campaign books (e.g. *Storm King's Thunder*) via **private modules**, without shipping copyrighted PDF text in git.

## Principles

- **Public repo:** SRD mechanics, original templates, engine code only.
- **Private disk:** `content/private/<module-id>/module.json` — your scene notes (gitignored).
- **PDF:** Local only; never committed; optional future local RAG on `localhost`.

## Phase 1 — Module loader (in progress)

| Task | File(s) | Status |
|------|---------|--------|
| Adventure types + scene `kind` | `src/lib/game/adventures/types.ts` | Done |
| Zod schema for `module.json` | `src/lib/game/adventures/module-schema.ts` | Done |
| Load `content/private/*/module.json` | `src/lib/game/adventures/load-private.ts` | Done |
| Registry: built-ins + private | `src/lib/game/adventures/registry.ts` | Done |
| `SceneId` → `string` on `GameState` | `src/lib/game/types.ts` | Done |
| `advanceScene` uses `sceneOrder` | `src/lib/game/state.ts` | Done |
| Catalog + session start use registry | `api/catalog`, `api/session/start` | Done |
| Mock DM uses scene `kind` | `src/lib/orchestrator/mock-dm.ts` | Done |
| Committed template module | `content/templates/example-frontier/module.json` | Done |
| Tests | `src/test/adventure-registry.test.ts` | Done |

## Phase 2 — SKT-sized campaigns

| Task | Notes |
|------|--------|
| Per-chapter `module.json` or `chapters[]` in one file | Start with Nightstone-only slice |
| Encounter refs → `encounters.yaml` | SRD creature ids from Open5e |
| Import Open5e monsters | `src/lib/game/srd/` |
| `POST /api/modules` dev-only validate | Upload JSON, validate schema |

## Phase 3 — Authoring UX

| Task | Notes |
|------|--------|
| CLI `pnpm module:validate` | Zod + path check |
| Scene editor (web) | Local dev tool |
| Module picker shows `private` badge | `/start` UI |

## Phase 4 — Local RAG (optional)

| Task | Notes |
|------|--------|
| `PARTYQUEST_LOCAL_RAG_URL` | Query localhost index |
| Desktop indexer script | User runs against owned PDF; never uploads |

## Phase 5 — Official licensing

| Task | Notes |
|------|--------|
| D&D Beyond / WotC partnership | Only path for shipping SKT to all users |

## Module JSON format (v1)

See `content/templates/example-frontier/module.json` and `src/lib/game/adventures/module-schema.ts`.

Copy template to:

```
content/private/my-skt-notes/module.json
```

Author **your own** goals/DCs — do not paste book text.

## SKT workflow (Josh)

1. Copy `content/templates/example-frontier/` → `content/private/skt-nightstone/`
2. Rename id/title; set `levelRange: [1, 5]`
3. For Chapter 1 scenes, one JSON scene per beat you run at the table
4. Keep PDF open for read-aloud; app runs dice + canon
5. Use SRD names for monsters (`ogre` → use SRD-compliant stat block in `monsters[]`)

## API changes

- `GET /api/catalog` → `scenarios` includes `source: 'builtin' | 'private'` and optional `levelRange`
- `POST /api/session/start` → `adventureId` any id from `listAdventureIds()`

## Verification

```bash
pnpm test
pnpm build
# Local: add content/private/test/module.json, restart dev, check /api/catalog
```
