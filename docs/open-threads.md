# Open Threads & Roadmap — Single Source of Truth

This is the **consolidated, ranked backlog** for AIDM. It merges the former
`todo.md` backlog, `current-risk-register.md`, the `ai-dm-app-gaps-and-next-steps.md`
gap list, `full-improvement-plan.md` Phase B, and the session's open threads.
When this file disagrees with older design docs, this file is newer.

Goal: **a production-scale AI Dungeon Master** on the three-pillar architecture:
1. **Rules engine** — code owns dice/HP/AC/combat; LLM only narrates. ✅ strongest pillar.
2. **State tracker** — structured, *persistent* world state injected each turn. ◐ in-session
   state + canon log + gazetteer exist; durable cross-session persistence is the gap.
3. **Spatial model** — a hard "current area" gate. ◐ weakest pillar; root of fidelity drift.

Legend — Impact: 🔴 high · 🟠 medium · ⚪ low. Effort: 🏔️ large · ⛰️ medium · 🪨 small.

---

## A. Ranked top priorities (architecture / production-readiness)

| # | Item | Pillar | Impact | Effort |
|---|------|--------|--------|--------|
| 1 | Durable server persistence (Postgres) | 2 | 🔴 | 🏔️ |
| 2 | Hard spatial-area gating + first-class scenes/NPCs (Phase 1 spatial awareness in progress) | 3 | 🔴 | 🏔️ |
| 3 | Structured scene-completion flags (replace log-keyword heuristics) | 1 | 🔴 | ⛰️ |
| 4 | Prompt versioning + eval CI (registry, changelog, fixtures) | — | 🔴 | ⛰️ |
| 5 | Turn legality / action economy (movement, reactions, turn ownership) | 1 | 🔴 | 🏔️ |
| 6 | Seeded PRNG + replay format for bug reports | 1 | 🟠 | ⛰️ |
| 7 | Safety / content moderation classifier on DM output | — | 🟠 | ⛰️ |
| 8 | Cost controls / rate limiting + "DM is busy" 429 state | — | 🟠 | ⛰️ |

> Detailed file-scoped plan for **#1 and #2**:
> [persistence-and-spatial-plan.md](persistence-and-spatial-plan.md).
> Active spatial roadmap:
> [spatial-awareness-roadmap.md](spatial-awareness-roadmap.md).

~~Claude as primary core brain~~ — **decided against; Groq is the core brain.**

## B. Rules & content depth

| Item | Impact | Effort |
|------|--------|--------|
| Spell/condition **duration** system (shield, bless, save-end) | 🟠 | ⛰️ |
| Full SRD conditions (movement effects, durations) | 🟠 | ⛰️ |
| Spells: tested SRD subset (targeting, slots, saves, buffs/debuffs) | 🟠 | 🏔️ |
| SRD character sheets (equipment, hit dice, proficiencies, progression) | 🟠 | 🏔️ |
| Character creation & leveling (species/class/background, ASI/feats) | 🟠 | 🏔️ |
| Enforce narrated-but-unapplied features (e.g. Second Wind) | 🟠 | ⛰️ |
| Tactical spatial combat (grid exists for one encounter only) | ⚪ | 🏔️ |

## C. Product polish

| Item | Impact | Effort |
|------|--------|--------|
| Real ambient audio (loops, mute/volume, mood crossfade) | 🟠 | ⛰️ |
| Mobile play layout (sticky input, character-sheet drawer) | 🟠 | ⛰️ |
| Failed-check UX (inline/toast feedback, recovery) — Phase B | 🟠 | ⛰️ |
| Accessibility pass (focus, live regions, labels, reduced-motion, a11y CI) | 🟠 | ⛰️ |
| Cold-start / "Begin" UX | 🟠 | ⛰️ |

## D. Module & campaign tooling

| Item | Impact | Effort |
|------|--------|--------|
| Encounter packs (`encounters.yaml`) | 🟠 | ⛰️ |
| Open5e/SRD import (monsters/spells/rules) | 🟠 | 🏔️ |
| Authoring UX (fuller scene/module editor) | ⚪ | 🏔️ |
| Localhost PDF index/query RAG flow (originally-planned variant) | ⚪ | ⛰️ |
| One-command index + gazetteer regeneration | 🟠 | 🪨 |
| Gazetteer extraction polish (paired names, OCR variants) | ⚪ | 🪨 |

## E. Brief gaps still open (from ai-dm-app-gaps-and-next-steps.md)

Party-split handling · whispers/secrets/PvP · deaf-accessibility specifics ·
network-drop/AFK handling · encounter balancing · cold-start UX · silence handling ·
DM personality continuity · Australian-English localisation · analytics/observability ·
host succession · crafting/downtime/weird asks · house rules/homebrew.
(Long-context drift is mitigated by the gazetteer + retrieval but not "solved".)

## F. Longer-term

Multiplayer rooms/WebSockets · private DM whispers · host succession · **voice I/O** ·
user accounts / billing / analytics dashboards · house rules/homebrew.

## G. Ops loose ends

Mock-DM fallback misfires · Preview-environment Vercel vars · merge the 4 original prod
backup keys · rotate Groq keys shared in chat · coordinate concurrent agents on `main`.

---

## Recently completed (this session)
- Durable server persistence through Postgres-backed session and recap storage.
- Spatial-awareness roadmap created; Phase 1 area-graph exploration movement is in progress.
- Engine/narrator split + multi-attempt self-healing narration validator.
- Fixed: LLM never used (schema/prompt contract); AI refusals discarded; weapon &
  monster damage dice; crit on disadvantage-discarded die; combat auto-start.
- Source-lore RAG: chunked index, hierarchical headings, heading-aware + conversation-
  aware retrieval, anti-invention guardrail, ~390-entry canonical gazetteer (Vercel Blob;
  book text out of git). Mitigates long-context drift; partial local-RAG.
- SKT fidelity: broken keep bridge, keep survivors, inn/Kella, special-event NPCs
  (Xolkin/Gurrash/Norgra/Rond), bell-ringers in the steeple.
- **Death saves on damage to downed characters** (`ecf0327`).
- **Seeded RNG for monster_turn target selection** (`492bd85`).
- 15 Groq keys for rate-limit headroom.
- **Decided against** a native Anthropic provider — Groq stays the core brain.

## Detailed plans
- [persistence-and-spatial-plan.md](persistence-and-spatial-plan.md) — items #1 and #2.
