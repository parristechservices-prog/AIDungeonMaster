---
doc: Published adventures implementation plan
project: PartyQuest / AIDungeonMaster
date: 2026-06-02
status: Phase 1 complete; Phase 2 partial
companions: published-adventures-guide.md
---

# Published Adventures Implementation Plan

Tracks engineering work to support **owned** campaign books through **private modules**, without shipping copyrighted PDF text in git.

For the current module backlog, see `docs/todo.md`.

## Principles

- **Public repo:** SRD mechanics, original templates, engine code only.
- **Private disk:** `content/private/<module-id>/module.json` contains the user's local scene notes and is gitignored.
- **PDF:** local only; never committed; optional future local RAG on `localhost`.

## Phase 1: Module Loader - Complete

| Task | File(s) | Status |
|------|---------|--------|
| Adventure types + scene `kind` | `src/lib/game/adventures/types.ts` | Done |
| Zod schema for `module.json` | `src/lib/game/adventures/module-schema.ts` | Done |
| Load `content/private/*/module.json` | `src/lib/game/adventures/load-modules.server.ts` | Done |
| Registry: built-ins + private | `src/lib/game/adventures/registry.server.ts`, `builtin-registry.ts` | Done |
| `SceneId` to `string` on `GameState` | `src/lib/game/types.ts` | Done |
| `advanceScene` uses `sceneOrder` | `src/lib/game/state.ts` | Done |
| Catalog + session start use registry | `api/catalog`, `api/session/start` | Done |
| Mock DM uses scene `kind` | `src/lib/orchestrator/mock-dm.ts` | Done |
| Template modules | `content/templates/example-frontier`, `skt-nightstone-starter`, `skt-nightstone-chapter1` | Done |
| Tests | `src/test/adventure-registry.test.ts`, SKT/module tests | Done |

## Phase 2: SKT-Sized Campaigns - Partial

| Task | Status |
|------|--------|
| `skt-nightstone-starter` template with original placeholders | Done |
| `skt-nightstone-chapter1` expanded template with original placeholders | Done |
| Optional `chapters[]` in module schema | Done |
| `pnpm run module:validate` / `module:scaffold` | Done |
| `POST /api/modules/validate` (dev only) | Done |
| `POST /api/modules/import` (dev only) | Done |
| `docs/scenario-authoring.md` | Done |
| Encounter refs or `encounters.yaml` | Planned |
| Import Open5e/SRD monsters | Planned |

## Phase 3: Authoring UX

| Task | Notes |
|------|-------|
| Module picker shows `private` badge | Done on `/start` |
| Local module JSON import | Done on `/start` in development |
| Scene editor web UI | Planned local dev tool |

## Phase 4: Local RAG - Optional

| Task | Notes |
|------|-------|
| `PARTYQUEST_LOCAL_RAG_URL` | Planned; query localhost index only |
| Desktop indexer script | Planned; user runs against owned PDF and never uploads extracted text |

## Phase 5: Official Licensing

| Task | Notes |
|------|-------|
| D&D Beyond / WotC partnership | Only path for shipping an official adventure to all users |

## Module JSON Format

See `content/templates/example-frontier/module.json` and `src/lib/game/adventures/module-schema.ts`.

Copy a template to:

```txt
content/private/my-notes/module.json
```

Author **your own** goals, DCs, monster references, and short notes. Do not paste book prose into committed files.

## SKT Workflow

1. `pnpm run module:scaffold -- skt-nightstone-starter skt-nightstone`
2. Edit `content/private/skt-nightstone/module.json` and replace every placeholder with short notes from the owned book.
3. `pnpm run module:validate -- content/private/skt-nightstone/module.json`
4. Run `pnpm dev` and pick the private module on `/start`.
5. Keep the PDF/book outside git; use the app for dice, state, canon, and narration support.

## API Changes Already Present

- `GET /api/catalog` returns scenarios with `source: 'builtin' | 'private' | 'template'` and optional `levelRange`.
- `POST /api/session/start` accepts any adventure id available from the registry.
- `POST /api/modules/validate` validates module JSON in development.
- `POST /api/modules/import` imports a local module JSON into `content/private/<module-id>/module.json` in development.

## Verification

```bash
pnpm test
pnpm build
```

Local manual check: add or import `content/private/test/module.json`, restart dev if needed, and confirm it appears in `/api/catalog` and `/start`.
