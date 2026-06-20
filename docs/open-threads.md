# Open Threads & Roadmap

Goal: **a production-scale AI Dungeon Master** (many users/campaigns), built on the
three-pillar architecture that serious AI-DM tools use:

1. **Rules engine** — code owns dice/HP/AC/combat; the LLM only narrates. ✅ This is
   AIDM's foundation (`src/lib/engine`, `heal-narration.ts`). Strongest pillar.
2. **State tracker** — structured, *persistent* world state (NPC status, faction,
   location, flags) injected each turn instead of trusting context memory. ◐ We
   have structured in-session `GameState` + canon log + gazetteer; missing durable
   cross-session persistence and semantic recall.
3. **Spatial model** — a hard "current area" gate so descriptions/NPCs come only
   from the active location. ◐ Weakest pillar; root cause of the keep/inn/bell
   drift we keep patching.

Items below are **not yet done**, ranked **highest impact / biggest change** (top)
to **lowest impact / smallest change** (bottom). Completed work is listed at the end.

Legend — Impact: 🔴 high · 🟠 medium · ⚪ low. Effort: 🏔️ large · ⛰️ medium · 🪨 small.

| # | Item | Pillar | Impact | Effort |
|---|------|--------|--------|--------|
| 1 | Hard spatial-area gating + first-class scenes/NPCs | 3 | 🔴 | 🏔️ |
| 2 | Persistent + semantic memory layer (durable state + lore recall) | 2 | 🔴 | 🏔️ |
| ~~3~~ | ~~Claude as primary core brain~~ — **decided against; Groq is the core brain** | — | — | — |
| 4 | Real party play (AI companion turns) | 1 | 🔴 | 🏔️ |
| 5 | Voice mode (narration TTS + speech-to-action) | — | 🟠 | 🏔️ |
| 6 | Procedural quest/encounter director | 1 | 🟠 | 🏔️ |
| 7 | Spell/condition duration system (shield, bless, etc.) | 1 | 🟠 | ⛰️ |
| 8 | 429 resilience + "DM is busy" state | — | 🟠 | ⛰️ |
| 9 | Slim back per-area campaignGuide patches (after #1) | 2 | 🟠 | ⛰️ |
| 10 | Enforce narrated-but-unapplied features (e.g. Second Wind) | 1 | 🟠 | ⛰️ |
| 11 | One-command index + gazetteer regeneration | 2 | 🟠 | 🪨 |
| 12 | Gazetteer extraction polish (paired names, OCR variants) | 2 | ⚪ | 🪨 |
| 13 | Mock-DM keyword fallback misfires | 1 | ⚪ | 🪨 |
| 14 | Preview-environment Vercel vars | — | ⚪ | 🪨 |
| 15 | Merge the 4 original prod backup keys | — | ⚪ | 🪨 |
| 16 | Rotate Groq keys shared in chat | — | ⚪ | 🪨 |
| 17 | Coordinate concurrent agents on `main` | — | ⚪ | 🪨 |
| 18 | Audit / run the other `C:\dev` apps | — | ⚪ | — |

---

## Details

### 1. Hard spatial-area gating + first-class scenes/NPCs 🔴🏔️ (pillar 3)
Track the party's `currentArea` as real state and gate descriptions, allowed NPCs,
monsters, exits, and source-lore retrieval to it — so the DM pulls only the active
location's content. Promote Nightstone's key content to modeled scenes with real
NPC entries (Kella, Gum-Gum, keep guards, Xolkin, Gurrash, Norgra, Rond) and engine
objects (the 750gp ring, the bridge jump check, the dead-goblin clue). Absorbs the
old "first-class scenes" and "sub-area precision" items. The durable cure for the
fidelity drift we've patched area-by-area; the starter module is already partly
scene-modeled and is the reference.

### 2. Persistent + semantic memory layer 🔴🏔️ (pillar 2)
Today state is in-memory per Vercel instance and resets. Add durable storage
(Vercel KV / Postgres) for `GameState` + canon log so campaigns survive restarts and
scale across users, and inject a compact, accurate "World State" dict each turn.
Optionally add vector embeddings for semantic lore recall (the keyword TF-IDF +
gazetteer we have already covers ~90% of the need cheaply; embeddings are the
"nice to have" upgrade, not a hard requirement).

### 3. ~~Claude as primary core brain~~ — DECIDED AGAINST
Groq (Llama) is the chosen core brain. We're staying Groq-only; not adding an
Anthropic provider. (The existing OpenAI/OpenRouter failover hooks remain for
emergencies, but Groq is primary by design.)

### 4. Real party play (AI companion turns) 🔴🏔️ (pillar 1)
`GameState.party[]` and `activeCharacterId` exist but play is solo. Drive companions
as AI actors in initiative, each resolving through the deterministic engine.

### 5. Voice mode 🟠🏔️
Behind the existing `voice` feature flag: narration via TTS, player intents via STT;
spoken intents still become engine-validated `engineRequests`.

### 6. Procedural quest/encounter director 🟠🏔️ (pillar 1)
Use `engine/balancer.ts` to assemble encounters scaled to party state — LLM proposes
flavor, engine picks stats/DCs. Replayability beyond hand-authored scenes.

### 7. Spell/condition duration system 🟠⛰️ (pillar 1)
`shield`/`bless` apply permanent conditions because there's no round/turn duration
tracking. Add a duration model so buffs expire.

### 8. 429 resilience + "DM is busy" state 🟠⛰️
When all keys are rate-limited the app silently drops to the weaker mock DM. Add a
short backoff after all keys are exhausted and surface a "rate-limited" state.

### 9. Slim back per-area campaignGuide patches 🟠⛰️ (pillar 2)
The keep/inn/event canon was added to the always-in-prompt `campaignGuide` as
reactive patches. Once #1 lands, return the guide to tone/flow and let the
state/retrieval backbone carry facts.

### 10. Enforce narrated-but-unapplied features 🟠⛰️ (pillar 1)
The LLM sometimes narrates a feature (e.g. Second Wind) without emitting
`use_feature`. Add a post-turn reconciliation or stronger prompt nudge.

### 11. One-command index + gazetteer regeneration 🟠🪨 (pillar 2)
Wrap `scripts/build-source-index.ts` + the Blob upload + env URL update into one
command for clean regeneration when the source book changes.

### 12. Gazetteer extraction polish ⚪🪨 (pillar 2)
Paired names (Vark, Yek) and OCR variants (Kella ↔ "Keila") aren't perfectly
captured; some notes are weak. Improve the extraction patterns.

### 13. Mock-DM keyword fallback misfires ⚪🪨 (pillar 1)
The table-rules mock occasionally returns a generic "I need more detail" for clear
inputs. Tune the keyword matching.

### 14. Preview-environment Vercel vars ⚪🪨
`GROQ_API_KEYS` and `SKT_SOURCE_BLOB_URL` are set on Production only (CLI looped on a
git-branch prompt). Add them via the dashboard for preview deploys.

### 15. Merge the 4 original prod backup keys ⚪🪨
The pre-existing production `GROQ_API_KEYS` backups are "Sensitive" and unreadable via
CLI, so they were replaced. Re-add them if their values are available.

### 16. Rotate Groq keys shared in chat ⚪🪨
Many keys were pasted into chat; rotate them in the Groq console. User action.

### 17. Coordinate concurrent agents on `main` ⚪🪨
A GitHub Copilot agent pushed commits concurrently. Avoid two agents writing to
`main` at once. Process note.

### 18. Audit / run the other `C:\dev` apps ⚪
Standing offer to dig into the other projects (Chess trainer, JoshOS, etc.).

---

## Recently completed
- Engine/narrator split + multi-attempt self-healing narration validator.
- Fixed: LLM never used (schema/prompt contract); AI refusals discarded; weapon &
  monster damage dice; crit on disadvantage-discarded die; combat auto-start.
- Source-lore RAG: chunked index, hierarchical headings, heading-aware retrieval,
  conversation-aware query, anti-invention guardrail, ~390-entry canonical gazetteer
  (Vercel Blob; book text out of git).
- SKT fidelity fixes: broken keep bridge, keep survivors, inn/Kella, special-event
  NPCs (Xolkin/Gurrash/Norgra/Rond), bell-ringers in the steeple.
- **#7 death saves on damage to downed characters** (`ecf0327`).
- **#14 seeded RNG for monster_turn target selection** (`492bd85`).
- 15 Groq keys for rate-limit headroom; source-fidelity roadmap.
