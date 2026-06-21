# Spatial Awareness Roadmap

Status: P1–P7 implemented, plus the combat-integration layer (opportunity
attacks, cover AC, authored terrain). Square-grid tactical combat is the
default; the hex adapter exists and is wired behind the same interface but is
not yet selected by any scenario.

## Combat integration layer (2026-06-21)

These close the "deferred" gaps from the P2–P7 pass:

- **Opportunity attacks — DONE.** `move_creature` now resolves real OAs: each
  hostile whose reach is left (reaction available, not Disengaged) rolls a melee
  attack against the mover, applies damage through the engine, and consumes its
  reaction. Outcomes ride on `EngineResult.opportunityAttacks`; narration drift
  is checked. (`resolveOpportunityAttacks` in `engine/index.ts`.)
- **Cover AC — DONE.** `player_attack` takes a `ranged` flag; ranged/spell
  attacks fold line-of-sight cover into effective AC (half +2, three-quarters
  +5) and total cover / blocked LOS refuses the shot. Melee ignores cover (5e).
- **Authored terrain — DONE.** `AuthoredBattleMap` + `authoring.ts` parse sparse
  scenario terrain (cells + regions) into `BattleMap.cells`; `start_combat`
  consumes it; Crypt of Whispers is authored with pillars, cover, and rubble.
- **HUD visibility — DONE (modest).** CombatHUD shows the active actor's
  remaining movement and action/reaction state.

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

## Status of previously-deferred items

Updated after the combat-integration pass (2026-06-21):

- **Opportunity attacks — RESOLVED.** Now rolled, applied, and reaction-consumed
  (see above).
- **Featureless battle maps — RESOLVED.** Authored terrain is supported and used
  by at least one encounter (see above).
- **Cover not applied to attacks — RESOLVED.** Cover now modifies effective AC
  and blocks total-cover shots in `player_attack`.

Still deferred, with reasons:

- **Multi-cell creature size — DEFERRED.** All actors occupy a single cell.
  Large+ footprints touch `occupantAt`, pathfinding, LOS, reach, and targeting
  simultaneously, so a correct 2×2+ implementation is its own focused pass.
  Deferred now because **all current content is Small/Medium**, so single-cell
  occupancy is exactly right for shipped scenarios; revisit when a Large+ monster
  is actually authored. (`SpatialActor.size` is tracked, unused in geometry.)
- **True corner-to-corner cover — ACCEPTED SIMPLIFICATION.** Cover is derived
  from sight/movement blockers along the Bresenham line plus the target cell's
  static `cover`. For text combat this is deterministic and good enough; exact 5e
  corner tracing changes outcomes only in rare grazing cases and isn't worth the
  complexity until there's a visible grid the player reasons about precisely.
- **Hex not proven via a scenario — DEFERRED.** `HexGridAdapter` is unit-tested
  but no scenario authors a hex `BattleMap` (`buildBattleMap` emits square, with
  authored override). End-to-end hex play is deferred until a wilderness-skirmish
  scenario needs it; the adapter seam means that's authoring, not engine work.
- **Flying movement cost / 3D pathfinding — DEFERRED (later phase).** Elevation
  affects distance, range, and falling, but pathfinding is 2D and flying has no
  movement-cost model. Genuinely a later phase: it needs a 3D cost model and UI
  to be playable, and no current encounter has verticality beyond falling.
- **Monster ranged cover — DEFERRED.** Cover is applied to `player_attack`
  (which now carries a `ranged` flag); `monster_turn` is treated as melee
  because the monster model has no ranged/reach metadata yet.
- **diagonalMode default is `simple_5ft`** (diagonal = 1 square). The
  `alternating_5_10` variant is implemented in the adapter but defaults off.
