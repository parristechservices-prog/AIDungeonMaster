# D&D 5e Rules Coverage

Honest status of which 5e rules the deterministic engine enforces, where, and
which tests cover them. The engine owns rules; the LLM/mock-DM only narrates
engine results.

## Implemented & tested

| Rule | Enforced in | Tests |
|---|---|---|
| Speed limits movement | `spatial/tactical/movement.ts` | `tactical-movement.test.ts` |
| Dash adds movement = speed, costs the action | `movement.ts` (`dash`) | `tactical-movement.test.ts`, `action-economy-format.test.ts` |
| Disengage prevents opportunity attacks | `movement.ts` (`disengage`) | `opportunity-attack.test.ts` |
| Leaving hostile reach triggers an OA (rolled + reaction consumed) | `engine/index.ts` (`resolveOpportunityAttacks`) | `opportunity-attack.test.ts` |
| Difficult terrain costs double | `movement.ts` (`enterCostFt`) | `tactical-movement.test.ts` |
| Blocked cells impassable; cannot end in occupied cell | `movement.ts` | `tactical-movement.test.ts`, `large-footprint.test.ts` |
| Melee requires reach; ranged requires range | `spatial/tactical/range-los.ts` | `tactical-range.test.ts` |
| Total cover blocks targeting; half +2 / three-quarters +5 AC | `range-los.ts`, `engine/index.ts` | `cover-attack.test.ts`, `monster-tactics.test.ts` |
| Large (2×2) footprint occupancy / movement / reach / LOS | `grid.ts`, `movement.ts` | `large-footprint.test.ts` |
| Attack rolls vs AC; damage applies to HP once | `engine/index.ts` | `engine.test.ts`, `opportunity-attack.test.ts` |
| Critical hit doubles dice; nat 1/20 detection | `engine/index.ts` | `engine.test.ts` |
| Skill checks: d20 + correct modifier vs DC | `engine/index.ts` (`skill_check`) | `engine.test.ts` |
| Death saves; downed-creature handling | `engine/index.ts` | `engine.test.ts` |
| Short / long rest resource restore | `engine/index.ts` | `engine.test.ts` |
| Spell slot decrement on cast | `engine/index.ts` | `engine.test.ts` |
| Conditions affecting advantage/disadvantage | `engine/index.ts` (`hasCondition`) | `engine.test.ts` |

## Partially implemented

- **Cover model** — line/Bresenham + static cell cover, not true corner-to-corner
  tracing (accepted simplification). Creature-as-cover is shown in queries but
  not folded into attack AC. (`range-los.ts`)
- **Z-axis / flying** — elevation affects 3D distance and falling damage; no 3D
  pathfinding or flying movement cost. (`falling.ts`)
- **Exploration ↔ scene sync** — `currentAreaId` does not advance with built-in
  scene transitions, so area-graph distance is static per session; the
  scene-aware authored table is used as the primary distance source. (gap)

## Not implemented (documented, not faked)

- Huge/Gargantuan (3×3+) footprints — only Large is multi-cell.
- Monster multiattack, damage types / resistance / vulnerability / immunity.
- Concentration tracking, saving-throw spells, reactions other than OAs.
- Encumbrance, exhaustion, flanking (no house rule), inspiration.

The mock-DM refuses or redirects unsupported requests rather than pretending they
resolved (see `mock-dm.ts` guards: rules arguments, homebrew, abusive spells,
action-economy pileups). Verified by `basic-player-prompts.test.ts` and
`player-playtest-adventures.test.ts`.
