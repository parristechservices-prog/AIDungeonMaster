# Spatial Awareness Roadmap

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
