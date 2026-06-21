# Player-facing Battlemap

A visible tactical map in `/play`, powered by the deterministic battlemap
view-model (`src/lib/play/battlemap-view.ts`). It **renders engine state and
suggests commands only** — it never mutates game state. Every real move/attack
still goes through the turn/API/engine, which validates legality.

## Components
- `src/lib/play/battlemap-view.ts` — pure view-model: `buildBattlemapView`
  (cells, terrain, cover, tokens, Large footprints, reachable-cell overlay),
  `interpretCellTap` (tap → typed interaction), `toDisplayCommand` (interaction
  → human command string).
- `src/components/play/Battlemap.tsx` — accessible HTML-grid renderer. Tokens are
  focusable buttons with aria-labels; light/dark classes; graceful fallback.

## What it shows
- Grid cells; party (blue), monster (red), NPC tokens; current-turn (emerald
  ring) and selected (amber ring) indicators; reachable-cell overlay for the
  selected token; Large 2×2 footprints; HP in token aria/title labels.
- **Terrain/cover overlay is gated behind DM View** (`showTerrainOverlay`); the
  default player map shows tokens + reachability only (no DM-only data).

## How taps become actions
1. Tap a token → selects it (no command).
2. Tap a reachable empty cell → suggests `Move <name> to (x, y)`.
3. Tap a hostile token → suggests `<name> attacks <target>`.
4. Tap an ally → reselects; tap an unreachable/out-of-bounds cell → no-op.

The suggestion is written into the input box (desktop) or input + closes the
drawer (mobile). **Nothing is submitted automatically** — the player reviews and
presses Send, then the engine approves or rejects it.

## Placement
- **Desktop:** sidebar tab toggle — **Character | Map** (`Map ⚔` when in combat).
- **Mobile:** a **Map** header button opens a bottom-sheet drawer; selecting a
  cell populates the input and closes the drawer so the composer stays usable.

## Empty / non-combat
When no combat battle map is active, the panel shows "No tactical map active" and,
if exploration state exists, the current area name and its exits. It never
crashes on undefined battleMap / inactive combat / no monsters / old sessions.

## Tests
`src/test/battlemap-view.test.ts` (13): token/terrain/footprint rendering,
selection, reachable overlay, move/attack suggestions, invalid-tap no-ops (no
mutation), display-command formatting. Component rendering itself is not
unit-tested (node-only test env); logic lives in the tested pure helpers.

## Known limitations
- The renderer is a static grid (no drag, pan/zoom, or animations).
- Condition badges are in labels, not icons.
- Map taps suggest text commands; there is no click-to-confirm-move shortcut.
- Not verified in a real browser in this pass (no browser environment).

## Unified Map: exploration + combat modes

The Map panel now works outside combat. `src/lib/play/map-view.ts` resolves a
mode and view-model; `Battlemap.tsx` renders it:

- **combat** (priority): the tactical battlemap (grid, tokens, terrain, cover,
  reachable cells) — unchanged.
- **exploration**: a zone/node map of the party's current area — "You are here"
  card (name + description), connected **exits** as tappable cards (label,
  difficulty, distance; gated exits shown 🔒 and disabled), present party/NPC
  chips, and base prompts. Built from `state.exploration` (area graph).
- **empty**: a useful fallback ("No authored map for this scene yet") with
  "Where am I? / What exits are available? / Who is here?" suggestion chips.

Taps **suggest commands only** (e.g. `Move to Drawbridge`, `Talk to Mira`) that
populate the input — they never mutate state; the engine still validates on send.
DM-only data is not surfaced (no hidden monsters; gated exits show as locked,
not as secrets). In **SKT Nightstone Chapter 1** the exploration map shows the
current area (e.g. the gatehouse) and its real connected exits with distances.

Adventures without an authored area graph (e.g. brindlehook-inn) show the empty
fallback. Exploration is a zone map, not an exact 5-ft tactical grid.
