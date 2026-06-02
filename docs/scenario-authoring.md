---
doc: Scenario & module authoring
project: PartyQuest
date: 2026-06-02
status: current guide
---

# Module authoring

> This guide describes the current private module workflow and scene schema for authoring scenarios compatible with the repo.

## Quick start (SKT or any owned book)

```bash
npm install
npm run module:scaffold -- skt-nightstone-starter skt-nightstone
# Edit content/private/skt-nightstone/module.json — replace YOUR NOTE fields
npm run module:validate -- content/private/skt-nightstone/module.json
npm run dev
```

Open `/start` → choose your **Private module**.

## File layout

| Path | Committed? | Purpose |
|------|------------|---------|
| `content/templates/<name>/module.json` | Yes | Shareable scaffolds (original text only) |
| `content/private/<id>/module.json` | No (gitignored) | Your campaign notes |

## Scene design

- Each playable scene needs `kind`: `social`, `exploration`, or `combat`.
- `sceneOrder` must end with `"ending"`.
- Optional `chapters[]` groups scenes for your reference (engine uses `sceneOrder` only).

## Mock DM block

Table-rules mode uses `mock` for skill DCs and success/failure lines. Write short lines you are happy to see in-game.

## Monsters

Use SRD-compatible names and stats you have rights to ship. For private modules, you may paste stats you need locally — never commit copyrighted stat blocks to a public repo.

## Tools

| Command | Description |
|---------|-------------|
| `npm run module:validate -- <path>` | Zod-check a module file |
| `npm run module:scaffold -- <template> [private-id]` | Copy template → `content/private/` |
| `POST /api/modules/validate` | Dev-only JSON body validation |

## See also

- `docs/published-adventures-guide.md`
- `docs/published-adventures-implementation.md`
