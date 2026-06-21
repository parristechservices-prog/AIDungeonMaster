# DM Screen and DM View

This document explains the DM-only observability UI in the play experience.

## Purpose

The DM Screen is a developer-focused panel set that reveals state and engine details without changing game rules.
It is designed to help a game master inspect:

- combatant action economy
- terrain overlays on the battle map
- cover / line-of-sight AC readouts
- opportunity attack outcomes
- narration warning checks
- monster stat blocks
- engine request/response details

## Controls

DM Screen visibility is controlled by the Dev Panel toggle button in the top-right of the play screen.
Each section is independent and defaults to OFF.

### Sections

- `Engine log`
  - shows raw engine request/result pairs per turn
  - includes summaries, success/failure, and optional tactical detail
- `Monster stat blocks`
  - shows monster AC, HP, speed, reach, and attack lines
- `Action economy`
  - shows each actor's movement spent/remaining, speed, action/bonus/reaction state
  - highlights active combatant, disengaged, prone, flying, and unconscious status
- `Terrain overlay`
  - applies terrain and cover shading to the combat grid in `CombatHUD`
- `Cover & line of sight`
  - shows attack cover math when an engine result includes cover data
- `Opportunity attacks`
  - shows resolved opportunity attacks and whether they hit or miss
- `Narration warnings`
  - shows warnings generated when intended narration diverges from computed state

## Implementation notes

- The Dev Panel settings are stored in `localStorage` via `src/lib/play/dev-panel.ts`.
- `src/app/play/page.tsx` passes `devPanel.showTerrainOverlay` through to `CombatHUD`.
- `src/components/play/DmPanels.tsx` renders panels only when any section is enabled.
- `src/components/play/EngineLogPanel.tsx` gates cover and opportunity attack details behind separate toggles.
- `src/components/play/ActionEconomyPanel.tsx` uses `actionEconomyRows()` from `src/lib/play/dev-panel-format.ts`.

## Default behavior

The normal player view remains unchanged by default.
A DM must explicitly enable sections to see additional debug/observability output.

## Battlemap integration

The player-facing battlemap (`docs/battlemap.md`) shares DM View's terrain
toggle: with `showTerrainOverlay` off the map shows only player-safe tokens and
reachability; with it on, the map colours terrain and shows cover badges. No
DM-only data appears on the map by default.
