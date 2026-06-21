# Spatial Awareness Roadmap

Status: P1–P7 implemented. Square-grid tactical combat is the default; the hex
adapter exists and is wired behind the same interface but is not yet selected by
any scenario.

## Implementation status

- **P1 — Area-graph exploration movement: DONE.** `src/lib/engine/spatial/`
  (`move_area` + queries), seeded into `GameState.exploration`, scoped prompt
  block, narration drift checks, inventory/canon-flag gating.
- **P2 — Square-grid tactical state: DONE.** `BattleMap`/`Cell`/`SpatialActor`
  in `src/lib/engine/spatial/tactical/types.ts`; replaces the old
  `{width,height,positions}` grid (migrated). `diagonalMode` is configurable.
- **P3 — Engine-owned movement: DONE.** `move_creature`, `dash`, `disengage`,
  `query_reachable`, `query_targets_in_range`, `check_line_of_sight`; Dijkstra
  pathfinding with terrain cost in `tactical/movement.ts`.
- **P4 — 5e movement rules: DONE.** Difficult terrain (double cost), blocked
  cells, occupied-cell rules (no ending on a creature, ally pass-through as
  difficult, hostile spaces blocked), opportunity-attack triggers + Disengage.
- **P5 — Range, reach, LOS, cover: DONE.** `tactical/range-los.ts` — melee reach,
  ranged range, Bresenham line of sight, half/three-quarters/total cover, cover
  AC bonus. Narration drift check for impossible attacks.
- **P6 — Z-axis: DONE (modest).** Elevation in 3D distance; `resolveFalling`
  applies 5e fall damage (1d6/10 ft, cap 20d6) and knocks prone.
- **P7 — Hex adapter: DONE (interface + impl, not yet selected).**
  `SpatialAdapter` with `SquareGridAdapter` (default) and an axial
  `HexGridAdapter`. Engine dispatch is adapter-agnostic via `adapterFor()`.

See "Deliberately deferred" at the bottom for simplifications.

## Original plan

Status: Phase 1 in progress.

The consensus from the spatial-awareness analyses is clear: the engine owns
spatial math and legality; the LLM narrates only what the engine confirms.
Prompting alone cannot reliably track movement, range, line of sight, or
terrain under pressure.

## P1: Area-graph exploration movement

In progress this sprint.

- Model exploration as named areas connected by explicit exits.
- Track actor locations in `ExplorationState.locations`.
- Resolve `move_area`, `query_current_area`, `query_exits`,
  `query_actors_present`, and `query_path_exists` through engine requests.
- Scope prompt context to the current area plus direct connections only.
- Add module authoring support for area graphs and seed adventures from that
  data.
- Add narration-vs-state drift warnings when prose claims travel the engine did
  not grant.

## P2: Square-grid tactical combat state

- Extend combat grid cells with terrain, cover, elevation, occupants,
  `blocksMovement`, and `blocksSight`.
- Keep the existing 5-foot square model as the tactical default.
- Store actor size, reach, speed, movement spent, action state, and reaction
  availability.
- Do not hardcode diagonal behavior; expose `diagonalMode` as a configuration
  choice.

## P3: Engine-owned movement requests

- Add `move_creature`, `dash`, `disengage`, `query_reachable`, and
  `query_targets_in_range`.
- Let the LLM ask for legal options instead of guessing a destination.
- Return movement cost, remaining movement, required Dash, and triggered
  reactions as structured engine facts.

## P4: 5e movement rules

- Difficult terrain: entering a 5-foot square costs 10 feet.
- Prone standing cost: half speed.
- Crawling and crawling through difficult terrain.
- Creature spaces: allied/hostile pass-through rules and no willing end in an
  occupied space.
- Opportunity attacks when leaving hostile reach, except Disengage, forced
  movement, teleportation, or rule-specific exceptions.

## P5: Range, reach, line of sight, and cover

- Enforce melee reach and ranged/spell distance from engine state.
- Add line-of-sight checks from cell geometry and sight-blocking terrain.
- Model half cover, three-quarters cover, and total cover.
- Validate narration that claims an attack, spell, or sight line against the
  engine result.

## P6: Z-axis, flying, and falling

- Add elevation for flying, climbing, ledges, pits, towers, and bridges.
- Track vertical distance for range and reach.
- Resolve falling when unsupported creatures lose altitude, including 5e fall
  damage rules.

## P7: Hex adapter

- Put grids behind a `SpatialAdapter`/`GridAdapter` interface.
- Add axial or cube-coordinate hex support for wilderness and natural movement.
- Keep engine request call sites stable across square, hex, and zone maps.

## Cross-cutting validation

Narration-vs-state drift is a first-class safety rail. Every spatial phase
should update validation so the final prose cannot claim impossible movement,
invalid range, nonexistent sight lines, unsupported cover, or engine-denied
arrival.

## Deliberately deferred / simplified

These are conscious cuts, not oversights:

- **Creature size & space.** All actors occupy a single cell (medium). Large+
  multi-cell footprints, squeezing, and size-based hostile pass-through are not
  modeled yet (`SpatialActor.size` is tracked but unused in geometry).
- **Opportunity attacks flag, don't resolve.** `move_creature` returns the ids
  of creatures that get an OA; rolling/applying that reaction is left to the
  existing attack pipeline (not yet hooked up to auto-resolve).
- **Cover model is approximate.** Cover is derived from sight-blocking and
  movement-blocking cells along the Bresenham line plus a target cell's static
  `cover`; it does not do true corner-to-corner 5e cover tracing.
- **Z-axis is partial.** Elevation affects distance and falling; flying movement
  cost, three-dimensional pathfinding, and climb/jump action costs are not done.
- **Hex not wired to content.** `HexGridAdapter` works and is tested, but no
  scenario builds a hex `BattleMap`; `buildBattleMap` always emits square.
- **Battle maps are featureless by default.** `buildBattleMap` seeds empty
  terrain; authoring per-encounter terrain/cover/elevation from module data is a
  follow-up.
- **diagonalMode default is `simple_5ft`** (diagonal = 1 square). The
  `alternating_5_10` variant is implemented in the adapter but defaults off.
