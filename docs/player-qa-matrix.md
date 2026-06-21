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

## Battlemap (added)
| Flow | Status | Where |
|---|---|---|
| Map renders tokens/terrain/footprints | ✅ | `battlemap-view.test.ts` |
| Tap suggests command (no mutation) | ✅ | `battlemap-view.test.ts` |
| Empty/non-combat fallback | ✅ | `Battlemap.tsx` (no-map state) |
| Desktop sidebar Map tab / mobile Map drawer | 👁 | manual (no browser env) |
| Terrain overlay gated by DM View | ✅ | `Battlemap.tsx` + `showTerrainOverlay` |

## Mobile UI status (this pass)
Fixed (structurally; **not browser-verified — no browser in this environment**):
- Compact header that stacks on mobile (title `text-base` + `line-clamp-2`; controls wrap as chips on a second row).
- Light/Dark toggle no longer floats over content on `/play` — it's an inline header chip (global floating toggle hides on `/play`).
- Ambient audio is a docked inline bar above the composer (was `fixed bottom-4 right-4`) — it can no longer overlay input/suggested actions.
- Composer uses `env(safe-area-inset-bottom)` padding; story area remains the flexible internally-scrolling region; suggested actions wrap above the composer.
- Character / Map / DM View open as drawers/sidebar tabs (unchanged behaviour).

Verification: `pnpm test` / `tsc` / `lint` / `pnpm build` pass. Viewports 360×800 / 390×844 / 412×915 and desktop 1366×768 / 1920×1080 are **not** automated (Playwright not added) and need a manual browser pass.

## Display Settings (added)
A player-facing "Display" button (always visible in the /play header) opens a
panel to show/hide optional UI: scene meta, mode pill, active character, turn
number, narration, dice panel, suggested actions, Appeal the DM, physical-dice
toggle, audio, and the Character/Map/DM View/Export/Theme/Back buttons, plus a
Compact mode. Presets: Full / Minimal / Combat / Story, and Reset layout.

| Flow | Status | Where |
|---|---|---|
| defaults all-visible; merge/parse/reset/presets | ✅ | `display-settings.test.ts` |
| Display opener can never be hidden | ✅ | not in settings model (`display-settings.test.ts`) |
| settings persist (localStorage `aidm.playDisplaySettings.v1`) | ✅ | `usePlayDisplaySettings` |
| toggles apply immediately to /play sections | 👁 | manual (no browser env) |
| narration hidden shows restore placeholder | ✅ | `page.tsx` |

Defaults keep everything visible. Settings are pure UI prefs — no engine/API/
game-state effect. Not browser-verified in this pass (no browser environment).

## Browser QA (Playwright) — added
Real headless-Chromium tests run against a local production build (`next start`).
Run with: `pnpm build` then `pnpm test:e2e` (config: `playwright.config.ts`,
specs in `e2e/`). Projects: **mobile 390×844** and **desktop 1366×768**.
Screenshots are saved to `test-results/screenshots/` (gitignored).

Browser-verified (12 tests, all passing):
- `/start` loads, no horizontal overflow, "Begin Quest" → `/play`, no console/page errors.
- `/play` core layout: no horizontal overflow, narration + input + Send + always-visible **Display** opener.
- Theme toggle flips the document theme class (mobile + desktop).
- Display settings drawer opens; toggling a section + Reset works; closes.
- Map opens (mobile drawer / desktop tab) and the composer stays usable; no overflow.
- DM View opens, **all toggles default off**, body contains no `sk-`/`api key` strings.

Bug found via browser QA: the theme button's accessible name is its `aria-label`
("Toggle dark mode"), not its visible text — fixed the test selector (app correct).

Still manual-only / deferred: **Map combat mode** (combat isn't deterministically
reachable through the UI without a fixture — covered by `battlemap-view.test.ts`),
manual/physical-dice modal flow, Appeal/Export deep behaviour, and
persistence/resume across reload. These are honest gaps, not verified here.
