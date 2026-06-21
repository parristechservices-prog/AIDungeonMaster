# Player QA Matrix

What a player can try in `/play`, and where it is covered. "Automated" = a
deterministic vitest test (table-rules / mock-DM path, no live LLM). "Manual" =
needs a browser and is not automated here.

Legend: ✅ automated · 🟡 partial · 👁 manual-only · ⬜ not covered

## A. Start / new game
| Flow | Status | Where |
|---|---|---|
| Create character, pick class | ✅ | `new-game.test.ts` |
| Select adventure / start game | ✅ | `new-game.test.ts`, `adventure-registry.test.ts` |
| Resume existing session | ✅ | `persistence.test.ts` |
| Invalid/missing setup | 🟡 | `new-game.test.ts` (defaults applied) |
| Mobile start flow | 👁 | — |

## B. Core play loop
| Flow | Status | Where |
|---|---|---|
| where am I / what do I see / who is here | ✅ | `player-playtest-adventures.test.ts`, `mock-dm-hints.test.ts` |
| exits available | ✅ | spatial engine (`area-graph.test.ts`) |
| suggested / freeform action | ✅ | `basic-player-prompts.test.ts` |
| rules question | ✅ | `mock-dm-hints.test.ts` (skill/AC/HP) |
| lore question (spoiler-safe) | ✅ | `player-playtest-skt.test.ts` |
| impossible action refused | ✅ | `player-playtest-adventures.test.ts` |
| appeal the DM | ✅ | `mock-dm` appeal branch |
| character sheet / campaign memory | 👁 | render-only components |
| light/dark, DM View toggle | 👁 / ✅ | `dev-panel-settings.test.ts` (defaults) |

## C. Spatial / exploration
| Flow | Status | Where |
|---|---|---|
| legal area movement | ✅ | `spatial-state.test.ts`, `area-graph.test.ts` |
| impossible movement (no teleport) | ✅ | `player-playtest-skt.test.ts`, `spatial-distance-regression.test.ts` |
| known landmark distance | ✅ | `spatial-distance-regression.test.ts`, `mock-dm-hints.test.ts` |
| Nightstone drawbridge/gate/square/keep routes | ✅ | `player-playtest-skt.test.ts`, `skt-nightstone-*.test.ts` |
| currentAreaId persists / no desync | 🟡 | `spatial-state.test.ts` (see 5e-rules-coverage gap note) |

## D. Combat
| Flow | Status | Where |
|---|---|---|
| start combat / initiative | ✅ | `engine.test.ts` |
| melee in/out of reach | ✅ | `tactical-range.test.ts`, `monster-tactics.test.ts` |
| ranged in/out of range | ✅ | `tactical-range.test.ts` |
| cover (half/three-quarters/total) | ✅ | `cover-attack.test.ts`, `monster-tactics.test.ts` |
| opportunity attack / disengage | ✅ | `opportunity-attack.test.ts` |
| dash / difficult / blocked terrain | ✅ | `tactical-movement.test.ts` |
| large creature footprint | ✅ | `large-footprint.test.ts` |
| invalid / non-present target | ✅ | `player-playtest-adventures.test.ts` |
| downed player / death save | ✅ | `engine.test.ts` |

## E–G. Action economy, resources, dice
| Flow | Status | Where |
|---|---|---|
| movement budget / dash consumes action | ✅ | `tactical-movement.test.ts`, `action-economy-format.test.ts` |
| reaction consumed by OA | ✅ | `opportunity-attack.test.ts` |
| short/long rest | ✅ | `engine.test.ts` |
| spell slots / features | ✅ | `engine.test.ts` |
| auto + manual dice, nat 1/20 | ✅ | `engine.test.ts`, `api-smoke.test.ts` |

## H. Persistence
| Flow | Status | Where |
|---|---|---|
| state persists / resume / migrate | ✅ | `persistence.test.ts`, `spatial-state.test.ts` (migration) |
| no duplicate turn application | ✅ | `mock-canonical.test.ts` |

## I. UI / layout / accessibility
| Flow | Status | Where |
|---|---|---|
| /play at 1366×768, 1920×1080, mobile | 👁 | not browser-verified in this pass |
| DM View hidden by default | ✅ | `dev-panel-settings.test.ts` |
| DM panels render data | ✅ | `dev-panel-format.test.ts`, `monster-statblock-format.test.ts` |

## J. Security / privacy
| Flow | Status | Where |
|---|---|---|
| no secrets / keys in responses | ✅ | `credentials.test.ts` |
| DM/raw data gated behind toggles | ✅ | `dev-panel-settings.test.ts` |
| no copyrighted SKT prose committed | ✅ | by policy — `skt-lore-facts.ts` holds facts only |

## Known manual-only gaps
- Browser layout at the three viewports (no browser in CI env).
- Live-LLM ("AI Director") narration quality — tests use deterministic table-rules.
- Character-sheet / campaign-memory visual rendering.
