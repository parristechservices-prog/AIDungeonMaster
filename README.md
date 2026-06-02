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
- Groq by default; `PARTYQUEST_LLM_PROVIDER` can select `openai` or a comma-separated failover list such as `groq,openai`

## Setup

```bash
pnpm install
cp env.example .env.local
pnpm dev
```

Then open `.env.local` and enter your keys:

```env
GROQ_API_KEY=your-primary-groq-key
GROQ_API_KEYS=backup-groq-key-1,backup-groq-key-2
```

If you also use OpenAI:

```env
OPENAI_API_KEY=your-primary-openai-key
OPENAI_API_KEYS=backup-openai-key-1,backup-openai-key-2
```

Open [http://localhost:3000](http://localhost:3000) → **Create adventure** to pick class, background, DM persona, and scenario.

### Environment

| Variable | Description |
|----------|-------------|
| `PARTYQUEST_LLM_PROVIDER` | Provider order, default `groq`; supports comma-separated failover such as `groq,openai` |
| `GROQ_API_KEY` | Primary Groq key (recommended) |
| `GROQ_API_KEYS` | Comma-separated backup Groq keys for failover |
| `GROQ_MODEL` | Default `llama-3.3-70b-versatile` |
| `OPENAI_API_KEY` | Primary OpenAI key, used when provider order includes `openai` |
| `OPENAI_API_KEYS` | Comma-separated backup OpenAI keys for failover |
| `PARTYQUEST_LLM_MODE` | Set to `light` to use the smaller Groq model |
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

### Private campaign modules (owned books)

```bash
pnpm run module:scaffold -- skt-nightstone-starter skt-nightstone
pnpm run module:validate -- content/private/skt-nightstone/module.json
```

Edit the private `module.json` with **your** scene notes (do not commit PDFs or book text). See `docs/skt-playbook.md`, `docs/published-adventures-guide.md`, and `docs/scenario-authoring.md`. Modules appear on `/start` when present locally.

## Feature flags

See `src/lib/config/features.ts` for roadmap toggles (voice, multiplayer, cloud save).

## Docs

- `docs/v0-feature-spec.md` — scope and done criteria
- `docs/ai-dm-app-gaps-and-next-steps.md` — longer-term product gaps
- `docs/dm-prompt-design.md` — prompt design notes
- `docs/audit-2026-06-02.md` — deep-dive audit (mock play-test, API, gaps matrix)
- `docs/full-improvement-plan.md` — improvement roadmap by product surface
- `docs/published-adventures-guide.md` — running owned books (e.g. SKT) legally; private modules
- `docs/TEN_IMPROVEMENTS.md` — brainstormed ideas (see audit for implementation status)

## License

Private / project-specific — see repository owner.
