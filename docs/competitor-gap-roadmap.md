# Competitor Gap Roadmap

Honest assessment of where AI Dungeon Master sits versus competitor AI-TTRPG
apps, and what shipped in this pass. The differentiator to protect is **strict
rules determinism** — the engine owns mechanics; the AI only narrates/suggests.

Status legend: ✅ implemented · 🟡 partial/scaffold · ⬜ not started

| # | Feature | Current | Competitor expectation | Proposed implementation | Complexity | Priority | Test coverage | Manual QA | After this pass |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Visual battlemap & tokens | ✅ player-facing panel (sidebar tab + mobile drawer) | draggable tokens, fog, range preview | view-model + `Battlemap.tsx` renderer; tap → suggested command (no mutation) | M | High | ✅ `battlemap-view.test.ts` (view-model, interaction, display commands) | visual/browser | ✅ shipped player-facing this pass (drag/pan deferred) |
| 2 | Mobile-first /play | 🟡 responsive shell (prev pass) | thumb-friendly, drawers, safe-area | drawers for Character/DM/Map, overflow menu, safe-area insets | M | High | ⬜ (node env; Playwright not added) | yes | 🟡 layout shell exists; mobile polish deferred |
| 3 | Multiplayer seats / invite | ⬜ party array only | seats, invites, async/live | seat state model + invite codes | L | Med | ⬜ | — | ⬜ deferred |
| 4 | Campaign save/load/library | 🟡 single-session persistence | library, resume, delete | client session library UI | M | High | partial (`persistence.test.ts`) | yes | ⬜ deferred |
| 5 | Worldbuilding generators | ⬜ | NPC/monster/item/location/quest | deterministic mock generators + schema validation | M | Med | ⬜ | — | ⬜ deferred |
| 6 | Character/NPC portraits | ⬜ | AI portraits | provider abstraction + no-key fallback | M | Low | ⬜ | — | ⬜ deferred |
| 7 | Monster/item/location gen | ⬜ | structured generators | validated drafts, confirm-before-insert | M | Med | ⬜ | — | ⬜ deferred |
| 8 | Text-to-speech narration | ⬜ | voice narration | Web Speech API + provider abstraction | S | Med | ⬜ | yes | ⬜ deferred |
| 9 | Image/scene art | ⬜ | scene art | provider scaffold, optional | M | Low | ⬜ | — | ⬜ deferred |
| 10 | Lore pages / entities | 🟡 CampaignMemory + campaign `knowledgeFacts` | entity DB, NPC/location pages | wire `knowledgeFacts` visibility into UI | M | High | ✅ `campaign-skt.test.ts` (data model) | yes | 🟡 data model done; pages deferred |
| 11 | Quest journal | 🟡 campaign `questFlags` (data) | journal UI | render quest state, known/secret split | S | Med | ✅ data via `campaign-skt.test.ts` | yes | 🟡 data done; UI deferred |
| 12 | Live AI consistency evals | 🟡 → ✅ harness | guardrails vs hallucination | contract tests through real schema+validators | M | High | ✅ `ai-consistency-harness.test.ts` | — | ✅ strengthened this pass |
| 13 | Discord/share/invite | ⬜ | share links | invite-code scaffold + docs | M | Low | ⬜ | — | ⬜ deferred |
| 14 | Onboarding/tutorial | 🟡 OnboardingBanner + tutorial adv | guided start | start-page polish | S | Med | partial (`new-game.test.ts`) | yes | ⬜ deferred |
| 15 | Accessibility settings | 🟡 dark mode, focus states | font size, reduced motion | settings store + classes | S | Med | ⬜ | yes | ⬜ deferred |
| 16 | DM View polish | ✅ toggles + panels | inspector | already shipped (prev passes) | — | — | ✅ `dev-panel-*` | — | ✅ stable |

## Shipped this pass
- **Battlemap view-model (Feature 1 core):** `src/lib/play/battlemap-view.ts` —
  `buildBattlemapView` (cells, terrain, cover, tokens, Large footprints,
  reachable-cell overlay) and `interpretCellTap` (tap → *suggested* move/attack
  command, never a state mutation). 10 tests.
- **AI consistency harness (Feature 12):** `src/test/ai-consistency-harness.test.ts`
  — schema accept/repair/reject, invented-movement detection, invented-hit
  detection, monster-at-0-HP and HP-contradiction drift, clean-turn no-warnings.
  Uses the real `dmTurnSchema` + `validateNarration*` — no live model. 10 tests.

## Honest deferral
This pass delivered the two highest-leverage *deterministic* slices plus this
roadmap. The remaining UI-heavy features (mobile drawers, battlemap renderer
wiring, session library, seats, generators, TTS, image gen, lore/quest pages,
Discord, onboarding, a11y) are **not implemented** — they need browser
verification this environment can't provide and/or are multi-pass efforts. They
are scoped above with priority order; recommended next: **wire the battlemap
view-model into a renderer component** and **the campaign session library**.
