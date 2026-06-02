---
doc: Full improvement plan (every product surface)
project: PartyQuest / AIDungeonMaster
date: 2026-06-02
status: current
audience: developers, product, coding agents
companions: audit-2026-06-02.md, ai-dm-app-gaps-and-next-steps.md, v0-feature-spec.md
---

# Full improvement plan

> **Accuracy note (2026-06-02):** This is a roadmap of desired improvements by surface. It includes target states that are not yet implemented. For the concise current backlog, see `docs/todo.md`.

Concrete ways to improve **every major surface** of the app: architecture, engine, LLM, mock DM, API, UI, persistence, audio, testing, ops, and future multiplayer. Ordered by leverage for the current V0 solo text prototype.

---

## 1. Architecture & orchestration

| Goal | Approach | Done when |
|------|----------|-----------|
| Single source of truth for mechanics | Engine never narrates; LLM never commits HP/dice without `engineRequests` | Already core; keep enforcing in reviews |
| Explicit turn contract | Keep Zod `dmTurnSchema`; add JSON Schema export for eval tools | Schema published in `docs/` |
| Request budget | Process up to 5 `engineRequests` per turn (schema max) | All mock multi-request turns apply canon/NPC updates |
| Fast mock-only mode | Skip LLM HTTP if no credentials; env `PARTYQUEST_FORCE_MOCK=true` | `/api/turn` &lt;50ms without keys |
| Two-phase narration | When `needsResultBeforeNarrating`, optional second LLM call with engine results only | AI path narrates outcomes without appending `(summary)` |
| Turn idempotency | `turnId` + dedupe for double-submit on mobile | Retrying Send doesn’t double-advance scene |

---

## 2. Rules engine

| Goal | Approach | Done when |
|------|----------|-----------|
| Seedable RNG in tests | `setRngSeed()` for Vitest; document in README | All engine tests deterministic |
| Advantage/disadvantage | Full 5e roll rules in `rollFormula` | Tests for adv/dis on attacks and saves |
| Death saves & unconscious | Wire existing types when player HP = 0 | Regression: "player at 0 HP" |
| Conditions | Prone, restrained, etc. affect AC/attacks per SRD subset | At least 3 conditions in combat |
| Spell effects | Start with 5–10 spells per class; engine resolves damage/healing | Wizard cast changes monster HP via engine |
| Encounter builder | `buildEncounter(partyLevel, difficulty)` from `monsters.ts` | New scenarios get balanced fights without hand-tuning |
| Appeal override | Engine flag `pendingRetcon` cleared only by host/DM turn | Documented escape hatch for wrong HP application |

---

## 3. LLM layer

| Goal | Approach | Done when |
|------|----------|-----------|
| Prompt as versioned files | Current prompt is inline in `src/lib/llm/system-prompt.ts`; move to `src/lib/llm/prompts/dm-system.v0.3.ts` + changelog header | Prompt diff visible in git |
| Eval harness | `evals/scenarios/*.json` — input, expected `engineRequests`, optional narration regex | `pnpm eval` runs on CI |
| Structured output hardening | Retry once on Zod failure with “fix JSON only” message | &lt;1% fallback rate with keys |
| Safety classifier | Current numeric validator only logs warnings; add small model, moderation endpoint, or rules pass before display | Blocked content never reaches UI |
| Cost control | Token estimate per turn; daily cap per session/IP | Graceful “limit reached” message |
| Context budget | Summarize recaps older than N turns; always inject full canon log | 50-turn session without contradiction spike |
| Provider abstraction | Current provider wrapper is a single function; introduce `LlmProvider` with Groq/OpenAI/mock implementations | Unit tests don’t hit network |

---

## 4. Mock / table-rules DM

| Goal | Approach | Done when |
|------|----------|-----------|
| No dead ends on failed checks | Failure narration + suggested actions; optional “soft advance” after 3 fails on same scene | Play-test: new user recovers without wiki |
| Scene-aware defaults | In `exploration`, don’t reply “Mira waits” | Wrong-scene phrases get scene-appropriate nudges |
| Per-scenario mock coverage | Each scenario in `scenarios/*.ts` has full mock block tested | 3/3 scenarios completable offline |
| Remove or gate flavor prefix | `PARTYQUEST_MOCK_FLAVOR=false` or delete wind-shift line | Mock text reads like in-world DM |
| Ambient in mock | Set `ambient: 'tavern' \| 'combat'` from scene | Mood indicator updates offline |
| Parity with AI | Mock uses same `engineRequests` shapes as prompt examples | Switching mock→AI doesn’t break state |

---

## 5. API & persistence

| Goal | Approach | Done when |
|------|----------|-----------|
| Durable sessions | Vercel KV / Postgres / Supabase for `session-{id}.json` | Refresh mid-game restores server state |
| Rate limiting | Per-IP turn limit on `/api/turn` | Abuse doesn’t drain API budget |
| Health endpoint | `GET /api/health` — engine version, LLM configured | Uptime monitors work |
| Session list | `GET /api/session` for dev — recent sessions | Debugging without `.data/` filesystem |
| Sync client snapshot | On turn, merge server truth with client UI preferences only | No split-brain HP display |

---

## 6. UI / UX

| Goal | Approach | Done when |
|------|----------|-----------|
| Appeal the DM | Button → prefixes `[APPEAL]` + helper text | Flag on home matches play UI |
| Failed check UX | Toast or inline: “Roll failed — try another approach” + highlight choices | Visible on failed `skill_check` |
| Dice transparency | Expand `DiceResults` with DC, modifier, pass/fail | Every check shows breakdown |
| Combat HUD | Show whose turn, available actions, monster HP bars | Player knows when to attack vs wait |
| Onboarding | 3-step overlay: talk → investigate → fight | First-time completion rate measurable |
| Ending + recap | Export recap as markdown; share link (future) | Player leaves with souvenir |
| Accessibility | Focus order, ARIA on narration log, reduced motion | axe-core clean on `/play` |
| Mobile layout | Sticky input, sheet drawer for character | Usable on phone Safari |

---

## 7. Audio & atmosphere

| Goal | Approach | Done when |
|------|----------|-----------|
| Real ambient loop | Royalty-free MP3/OGG per mood; Web Audio crossfade | Toggle in settings; respects mute |
| Or honest UX | Rename to “Scene mood” until audio ships | No “audio” in UI without sound |
| User volume | Master + ambience sliders in settings | Preference in localStorage |

---

## 8. Content & scenarios

| Goal | Approach | Done when |
|------|----------|-----------|
| Scenario authoring guide | `docs/scenario-authoring.md` — scenes, mock, monsters | New scenario in &lt;2 hours |
| Background hooks | Background affects opening line + one canon fact (partial today) | All 4 backgrounds differ in play |
| Branching endings | Engine `flags` + scene transitions | At least 2 endings per scenario |
| Content safety tags | Scenario metadata: violence level | Filter in catalog API |

---

## 9. Testing & quality

| Goal | Approach | Done when |
|------|----------|-----------|
| Expand Vitest | 30+ tests: schema reject, mock per scene, narration warnings | CI green |
| Playwright E2E | Start → complete one-shot with mock | Runs on PR |
| LLM eval (optional) | Recorded fixtures with VCR; don’t call live API in CI | Nightly job only |
| Load smoke | 50 concurrent turns on mock mode | No session corruption |

---

## 10. DevOps & product

| Goal | Approach | Done when |
|------|----------|-----------|
| Sync `v0-feature-spec.md` with shipped features | Single checklist in README | No “Fighter only” drift |
| One package manager | Remove duplicate lockfile; document pnpm | CI and local match |
| Analytics events | `turn_completed`, `scene_advanced`, `session_ended` | Dashboard or Plausible |
| Playtest protocol | Use `docs/playtest-protocol.md` (create from gaps doc §3.8) | 5 external sessions logged |

---

## 11. Future: multiplayer & voice (post-V0)

Not for current sprint; capture intent:

- **Voice:** STT → same `/api/turn` → TTS stream; filler audio during LLM wait
- **Rooms:** WebSocket room state; engine authoritative; one LLM turn per party action queue
- **Whispers:** Private channel per playerId in turn payload
- **Spatial grid:** Engine-owned positions; LLM reads grid summary only

---

## Implementation phases

### Phase A — Trust & offline play (shipped 2026-06-02)

- [x] Skip LLM without credentials; `PARTYQUEST_FORCE_MOCK`
- [x] Engine request cap = 5
- [x] Mock failure hints + scene nudges
- [x] Appeal button; mood indicator honesty
- [x] Tests + doc fixes (`TEN_IMPROVEMENTS.md`)
- [ ] Onboarding v2 for failed checks (inline toast) — Phase B

### Phase B — Persistence & polish

- Server-side session store (KV)
- Real ambient audio or remove mood icons
- Onboarding v2; failed-check UI
- Prompt files v0.3 + eval folder

### Phase C — Depth

- More engine (conditions, spells)
- Encounter builder
- E2E + analytics
- Safety classifier

---

## Success metrics

| Metric | Target |
|--------|--------|
| Mock one-shot completion (first try, no docs) | ≥70% of play-testers |
| Median turns to ending (Brindlehook) | 8–15 |
| Narration validation warnings per session | &lt;3 |
| `/api/turn` p95 latency (mock) | &lt;200ms |
| `/api/turn` p95 latency (LLM) | &lt;4s |

---

*Update this doc when phases complete or priorities shift.*
