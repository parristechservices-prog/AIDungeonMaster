# PartyQuest V0

Solo text-only fantasy RPG prototype: a **deterministic rules engine** owns mechanics; an **LLM narrator** owns prose.

Repository: [github.com/parristechservices-prog/AIDungeonMaster](https://github.com/parristechservices-prog/AIDungeonMaster)

## Architecture

```
Player input → /api/turn → LLM (structured JSON) → engine resolves requests → narration + state
                                    ↓ (no API key)
                              mock DM fallback
```

- **Engine** (`src/lib/engine`) — dice, HP, combat, skill checks. Never writes story text.
- **LLM** (`src/lib/llm`) — DM turns as JSON with `engineRequests` + `narration`.
- **Orchestrator** (`src/lib/orchestrator`) — validates schema, runs engine, builds recaps.
- **UI** (`src/app/play`, `src/components/play`) — narration, combat HUD, dice breakdown, clickable choices, ending screen.

Narration is checked against engine state (`validate-narration.ts`); warnings are logged and surfaced in dev.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4
- Zod + Vitest
- Groq-first LLM (OpenAI fallback)

## Setup

```bash
pnpm install
cp env.example .env.local
# Add GROQ_API_KEY and/or OPENAI_API_KEY
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) → **Create adventure** to pick class, background, DM persona, and scenario.

### Environment

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | Primary LLM (recommended) |
| `GROQ_MODEL` | Default `llama-3.3-70b-versatile` |
| `OPENAI_API_KEY` | Fallback / `PARTYQUEST_LLM_PROVIDER=openai` |
| `PARTYQUEST_LLM_MODE` | `light` for smaller Groq model when unset |
| `PARTYQUEST_DEV_LOGS` | `true` writes turn logs under `.data/` |
| `PARTYQUEST_FORCE_MOCK` | `true` skips LLM calls (table-rules only) |
| `PARTYQUEST_MOCK_FLAVOR` | `true` adds the legacy fallback narration prefix |

Without API keys, the **table-rules mock DM** runs the full one-shot.

## Scripts

```bash
pnpm dev          # local server
pnpm test         # Vitest (engine + regression + narration validator)
pnpm lint
pnpm build
```

## Deploy (Vercel)

1. Import the GitHub repo in [Vercel](https://vercel.com).
2. Set environment variables from `env.example`.
3. Deploy — `vercel.json` uses `pnpm build`.

**Note:** Session files persist to `.data/` locally; on Vercel, state is in-memory per instance. Client-side snapshot (`localStorage`) helps resume UI state between visits.

## Character & scenario options

| Characters | Scenarios | Backgrounds | DM personas |
|------------|-----------|---------------|-------------|
| Fighter, Wizard, Rogue, Cleric | Brindlehook Inn, Crypt of Whispers, Smuggler's Cove | Soldier, Scholar, Criminal, Acolyte | Classic, Gritty, Epic, Whimsical |

Setup UI: `/start` · Catalog API: `GET /api/catalog` · New game: `POST /api/session/start`

Add more entries in `src/lib/game/characters/templates.ts` and `src/lib/game/scenarios/`.

## Feature flags

See `src/lib/config/features.ts` for roadmap toggles (voice, multiplayer, cloud save).

## Docs

- `docs/v0-feature-spec.md` — scope and done criteria
- `docs/ai-dm-app-gaps-and-next-steps.md` — longer-term product gaps
- `docs/dm-prompt-design.md` — prompt design notes
- `docs/audit-2026-06-02.md` — deep-dive audit (mock play-test, API, gaps matrix)
- `docs/full-improvement-plan.md` — improvement roadmap by product surface
- `docs/TEN_IMPROVEMENTS.md` — brainstormed ideas (see audit for implementation status)

## License

Private / project-specific — see repository owner.
