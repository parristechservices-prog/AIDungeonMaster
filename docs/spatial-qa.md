# Spatial QA / Playtest Notes

Manual QA checklist plus the regression record for the landmark-distance fix.
The deterministic engine/game state owns spatial truth (distance, movement,
legality); the LLM/mock DM only narrates engine-backed facts.

## Regression: "how far away is the drawbridge from me?"

- **Scenario:** Giants on the Frontier / Nightstone Chapter 1 (`skt-nightstone-chapter1`)
- **Scene:** `road-to-nightstone` (first playable scene, kind `exploration`)
- **Prompt:** `how far away is the drawbridge from me`

**Before:** vague non-answer ("You look around and see the drawbridge in the
distance. You wonder how far away it is.").

**Root cause:** two compounding issues —
1. The distance plumbing in `mock-dm.ts` (table-rules path) was left in a
   broken, half-finished state (a syntax error in the combat-branch distance
   handler, a wrong-argument call to `explorationPositionHint`, leftover
   `console.log` debug, and an `AreaId` import from the wrong module), so the
   build did not even compile locally.
2. The deployed app was behind `main`, so prod never had the distance handling.

**After (deterministic, engine/data-backed):**
> "You are about 30 feet from the lowered drawbridge. With <name>'s 30-foot
> speed, that is within one normal move. You are still on the road outside the
> moat."

Distance comes from authored scene-aware data (`getDistanceHint`) first, with
the exploration area-graph route distance (`query_path_exists` now returns
`distanceFt`) as a fallback for landmarks the scene table doesn't cover. The LLM
never invents the number.

Covered by `src/test/spatial-distance-regression.test.ts` and the existing
`src/test/mock-dm-hints.test.ts` / `skt-nightstone-starter.test.ts` distance tests.

## Manual QA checklist

1. Open `/play`, start Giants on the Frontier / Nightstone.
2. Ask "Where am I and what exits are available?" → current area + exits.
3. Ask "How far away is the drawbridge from me?" → numeric feet + movement note.
4. Try impossible travel ("I run to the giant's tower") → no teleport; the DM
   redirects rather than committing a scene change.
5. Move through legal connected areas → succeeds.
6. Enter combat; test movement budget, Dash, Disengage, opportunity attacks.
7. Open **DM View** (button in the `/play` header, next to "Export Recap").
8. Toggle each section: action economy, engine log, terrain overlay, cover/LOS,
   opportunity attacks, monster stat blocks, narration warnings.
9. Confirm all toggles are **off by default** and DM data is hidden until enabled.
10. Check layout at 1366×768, 1920×1080, and a mobile width.

## Known limitations / deferred

- Exploration `currentAreaId` does not advance with built-in scene progression,
  so the area-graph route distance is static per session; the scene-aware
  authored table is used as the primary source for that reason.
- Layout polish at specific viewports was not visually verified in this pass (no
  browser available in the working environment) — see report notes.

## Exploration distance questions (any scene)
Ordinary spatial/distance questions ("how far to the water?", "how close is the
boathouse?", "how far away is the drawbridge?") are answered in ANY scene, not
just combat (`isExplorationDistanceQuestion` / `answerExplorationDistanceQuestion`
in `mock-dm.ts`, handled before the scene-kind branches):
- With exploration state → deterministic numeric distance (e.g. SKT drawbridge).
- Without (e.g. Brindlehook) → honest approximate answer naming the target +
  known leads; never an invented exact number.
- Never "No tactical battle map is active" for an ordinary distance question.
  That engine refusal is also filtered from player narration (page.tsx) and the
  AI prompt forbids tactical requests outside combat. Regression:
  `exploration-distance.test.ts`.
