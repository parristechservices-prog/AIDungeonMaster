# Comprehensive Playtest Report

- **Date:** 2026-06-21
- **Branch:** main
- **Environment:** local, deterministic table-rules / mock-DM path (no live LLM)
- **Reference:** Storm King's Thunder (used privately as QA reference; only
  structured facts extracted — no copyrighted prose committed)

## Scope

Player-facing QA across all registered adventures, SKT lore consistency, and the
implemented 5e rules. Tests run through the same internal turn functions
(`deriveDmTurnFromInput`, `runTurn`, `resolveEngineRequest`) that `/api/turn`
uses in table-rules mode, so results are deterministic and reproducible.

## Adventures tested (7)

`tutorial`, `brindlehook-inn`, `crypt-of-whispers`, `smugglers-cove`,
`example-frontier`, `skt-nightstone-chapter1`, `skt-nightstone-starter`.

Each gets an automated smoke playtest: orientation answer, impossible-action
refusal, no teleport, coherent post-turn state, and graceful handling of an
attack with no valid target (`player-playtest-adventures.test.ts`).

## Storm King's Thunder lore checks

`player-playtest-skt.test.ts` + `src/test/fixtures/skt-lore-facts.ts`:

- Nightstone presented as attacked/abandoned, not a bustling village.
- Drawbridge distance answered with a concrete number.
- Spoiler gating: "is Iymrith the villain?", "where is King Hekaton?", Serissa/
  Neri, Kraken Society → honest "beyond current knowledge", no plot leak, no
  search roll fired.
- No canonical contradiction (Iymrith-as-silver/friendly, Hekaton-in-Nightstone,
  Serissa-as-enemy, etc.) ever appears in a lore answer.
- Movement legality: no teleport to the giant's tower; legal drawbridge/gate
  movement advances; distance stays coherent after a scene advance.

## 5e rules checks

See `docs/5e-rules-coverage.md`. Implemented rules (movement/Dash/Disengage/OA/
difficult+blocked terrain/reach/range/cover/large footprint/attack-vs-AC/crit/
skill checks/death saves/rests/spell slots) all have regression tests.
Unsupported rules are documented honestly, not faked.

## Pass/fail summary

| Command | Result |
|---|---|
| `npx vitest run` (full) | ✅ 41 files, 348 tests pass |
| `npx tsc --noEmit` | ✅ clean |
| `npx eslint src` | ✅ clean |
| `npx next build` | ✅ success |

## Issues found & fixed this pass

- **mock-DM spoiler/lore handling:** lore questions about SKT secrets fell through
  to a generic search skill-check (poor answer; wrong engine request). Added a
  deterministic `isLoreSecretQuestion` handler that answers honestly without
  leaking the plot and without rolling. (`mock-dm.ts`)

(Prior pass fixed the broken landmark-distance plumbing and the build-breaking
syntax/type errors — see `docs/spatial-qa.md`.)

## Issues deferred (honest)

- Browser/viewport layout (1366×768, 1920×1080, mobile) — **not** verified; no
  browser in this environment. Listed manual-only in `player-qa-matrix.md`.
- Live "AI Director" narration quality — not deterministically testable; covered
  only via table-rules.
- Exploration `currentAreaId` does not advance with built-in scenes (distance
  uses the scene-aware table as primary source).
- 5e gaps in `5e-rules-coverage.md` (multiattack, damage types/resistance,
  concentration, saving-throw spells, Huge+ footprints).

## Is "100% consistent" proven?

**No — and that claim should not be made.** What is proven: the implemented
engine rules, the SKT lore facts in the fixture, spoiler gating, movement
legality, and all-adventure smoke flows pass deterministically (348 tests).
What is **not** proven: live-LLM narration consistency, browser UI/layout, and
the unimplemented 5e rules listed above. Those are the remaining gaps.
