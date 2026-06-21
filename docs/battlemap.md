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
