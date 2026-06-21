---
doc: Rules Engine Technical Spec
project: PartyQuest / DM-in-a-Box
status: target design v0.1; partially implemented
owner: Josh Parris
date: 2026-05-12
audience: developers, coding agents, future Josh
companion: v0-feature-spec.md
---

# Rules Engine Technical Spec — DM-in-a-Box

> **Accuracy note (2026-06-02):** This document is the intended rules-engine contract, not a complete description of current code. The current engine has a narrower `EngineRequest` union in `src/lib/engine/types.ts`, resolves requests through `resolveEngineRequest` in `src/lib/engine/index.ts`, uses `Math.random()` rather than a seedable PRNG, and implements partial conditions, spells, rests, features, physical dice, and encounter balancing. Use `docs/todo.md` for current implementation gaps.
>
> **Spatial update (2026-06-21):** Spatial awareness now lives in `src/lib/engine/spatial/`. Exploration uses an area graph (`ExplorationState`, `move_area`/`query_*`). Tactical combat uses `src/lib/engine/spatial/tactical/` — `BattleMap`/`Cell`/`SpatialActor`, Dijkstra movement, Dash/Disengage, range/reach, Bresenham line of sight, cover, z-axis falling, and a `SpatialAdapter` (square default, hex available). The combat grid is `CombatState.battleMap` (the old `{width,height,positions}` shape is migrated). **Combat integration:** `move_creature` resolves real opportunity attacks (roll + damage + reaction consumed, on `EngineResult.opportunityAttacks`); `player_attack` accepts `ranged` and folds cover into effective AC (total cover refuses the shot); encounters can author terrain via `AuthoredBattleMap` consumed by `start_combat`. **Monster symmetry:** monsters carry `MonsterAttack` metadata (melee/ranged, reach, range); `monster_turn` is engine-driven (nearest target, melee reach, ranged range/LOS/cover via the same path as `player_attack`, deterministic move-into-reach, no teleport). **Creature size:** `SpatialActor.size` drives footprints — Large is a real 2×2 for occupancy/movement/reach/LOS; Huge+ deferred. See `docs/spatial-awareness-roadmap.md` for full status and deferred items.

## Purpose

Define the deterministic half of the hybrid architecture. The rules engine owns every number in the game. The LLM owns every word. This document specifies the data model, the public API surface, and the JSON contract that connects them.

If the engine and the LLM bleed into each other, the product fails. This spec is the wall between them.

## Scope (V0)

This spec covers V0 only — the solo, text-only, 30-minute one-shot defined in `v0-feature-spec.md`. The engine is designed to extend, but V0 is the binding contract.

### In scope

**Character mechanics**
- Ability scores (STR, DEX, CON, INT, WIS, CHA) and modifiers
- Proficiency bonus by level
- Skill proficiencies and skill modifiers
- Saving throw proficiencies and save modifiers
- AC (from armour + DEX, no shields complexity for V0)
- HP: current, max, temporary
- Speed (single value, no swim/fly/climb distinction)
- Passive perception

**Dice**
- d4, d6, d8, d10, d12, d20, d100
- Advantage / disadvantage on d20
- Critical hit detection (natural 20)
- Critical fumble detection (natural 1) — informational only, no auto-miss
- Seedable PRNG for reproducible tests

**Combat**
- Initiative rolls + turn order
- Action economy: action, move, bonus action (bonus action tracked but unused in V0)
- Attack rolls (melee + ranged) with proficiency, modifier, advantage state
- Damage rolls with damage type tag
- Death saves (3 successes / 3 failures, stabilise rules)
- Encounter start / end

**Conditions** (V0 subset)
- prone, unconscious, dead, stable

**Resources**
- Spell slot tracking infrastructure (Fighter has none — slot data model exists for V1)
- Hit dice tracking
- Short rest (spend hit dice to heal)
- Long rest (full HP, half hit dice back, slots restored)

**Skill checks**
- Roll a d20 + ability mod + proficiency (if applicable) vs DC
- All 18 standard skills available

**Saving throws**
- Roll a d20 + ability mod + proficiency (if proficient) vs DC

### Explicitly out of scope (V0)

These have no engine implementation. The LLM may not request them.

- Concentration mechanics
- Reactions and opportunity attacks
- Multi-class rules
- Levelling up
- Encumbrance and carrying capacity
- Cover (half, three-quarters, full)
- Vision, light, darkvision
- Grapple, shove, push
- Damage resistance / vulnerability / immunity (damage type is recorded, but no mitigation applied in V0)
- Magic items and attunement
- Spellcasting effects (only slot decrement is modelled)
- Movement on a grid (theatre-of-the-mind only)
- Difficult terrain
- Ranged weapon range bands (in / out)
- Two-weapon fighting
- Ammunition tracking
- Currency
- Inventory weight or slot counts

### Architectural principles (non-negotiable)

1. **The engine is pure TypeScript.** No HTTP calls, no AI calls, no DOM, no `fetch`. It can be unit-tested in any Node environment with no mocks.
2. **The engine never narrates.** Every function returns a structured result, never prose.
3. **The engine is deterministic.** Same state + same input + same seed = same output. Always.
4. **The engine never trusts the LLM.** Every request from the LLM passes through `validateRequest()` before any state changes.
5. **State is immutable.** Functions return a new `GameState` and a list of `GameEvent`s. No in-place mutation.
6. **All randomness flows through one PRNG.** Test mode uses a seeded PRNG; production uses a crypto-seeded one.

## Data model

All types live in `/lib/engine/types.ts`. The model is intentionally narrow for V0; future versions add fields, not new modules.

### Core enums and primitives

```ts
type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

type Skill =
  | 'acrobatics' | 'animal_handling' | 'arcana' | 'athletics'
  | 'deception' | 'history' | 'insight' | 'intimidation'
  | 'investigation' | 'medicine' | 'nature' | 'perception'
  | 'performance' | 'persuasion' | 'religion' | 'sleight_of_hand'
  | 'stealth' | 'survival';

type DamageType =
  | 'slashing' | 'piercing' | 'bludgeoning'
  | 'fire' | 'cold' | 'lightning' | 'thunder' | 'acid' | 'poison'
  | 'necrotic' | 'radiant' | 'force' | 'psychic';

type ConditionId = 'prone' | 'unconscious' | 'dead' | 'stable';

type AdvantageState = 'normal' | 'advantage' | 'disadvantage';

type DiceFormula = string; // e.g. "1d8+3", "2d6"
```

### Character

```ts
type Character = {
  id: string;
  name: string;
  kind: 'pc';
  level: number;
  className: 'fighter'; // V0 restriction
  speciesName: string; // flavour only; no mechanical effects in V0
  abilityScores: Record<Ability, number>;
  proficiencyBonus: number;
  skillProficiencies: Skill[];
  savingThrowProficiencies: Ability[];
  armorClass: number;
  speed: number;
  hp: { current: number; max: number; temp: number };
  hitDice: { total: number; remaining: number; die: 'd10' };
  spellSlots: Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, number>; // all zero for Fighter
  conditions: ActiveCondition[];
  deathSaves: { successes: number; failures: number };
  equipment: EquipmentSlot;
  inventory: Item[];
  features: CharacterFeature[]; // class features, e.g. Second Wind
};

type EquipmentSlot = {
  mainHand?: Weapon;
  offHand?: Weapon | Shield;
  armor?: Armor;
};

type CharacterFeature = {
  id: string; // e.g. 'second_wind', 'action_surge'
  name: string;
  uses: { max: number; remaining: number };
  rechargeOn: 'short_rest' | 'long_rest';
};
```

### Monster

```ts
type Monster = {
  id: string;
  name: string;
  kind: 'monster';
  abilityScores: Record<Ability, number>;
  armorClass: number;
  speed: number;
  hp: { current: number; max: number; temp: number };
  challengeRating: number;
  attacks: MonsterAttack[];
  conditions: ActiveCondition[];
  savingThrowBonuses: Partial<Record<Ability, number>>;
  skillBonuses: Partial<Record<Skill, number>>;
};

type MonsterAttack = {
  id: string;
  name: string; // e.g. 'Scimitar', 'Shortbow'
  attackBonus: number;
  damage: DiceFormula;
  damageType: DamageType;
  reach: 'melee' | 'ranged';
};
```

### Item / Weapon / Armor

```ts
type Item = { id: string; name: string; description?: string };

type Weapon = Item & {
  kind: 'weapon';
  damage: DiceFormula;
  damageType: DamageType;
  properties: WeaponProperty[];
  reach: 'melee' | 'ranged';
};

type WeaponProperty = 'finesse' | 'light' | 'heavy' | 'two_handed' | 'versatile';

type Armor = Item & {
  kind: 'armor';
  baseAc: number;
  dexBonus: 'full' | 'capped_2' | 'none';
  category: 'light' | 'medium' | 'heavy';
};

type Shield = Item & { kind: 'shield'; acBonus: number };
```

### Spell (infrastructure only for V0)

```ts
type Spell = {
  id: string;
  name: string;
  level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  school: string;
  castingTime: 'action' | 'bonus_action' | 'reaction' | 'minute' | 'longer';
  range: number; // feet, 0 for self
  damage?: { formula: DiceFormula; damageType: DamageType };
  savingThrow?: { ability: Ability; effectOnSuccess: 'half' | 'none' };
  description: string; // narrative only; engine does not parse this
};
```

V0 ships with ~5 spells in `/data/spells.json` for type-system validation. None are cast.

### Action

```ts
type Action =
  | { kind: 'attack'; weaponId: string; targetId: string }
  | { kind: 'cast_spell'; spellId: string; slotLevel: number; targetIds: string[] }
  | { kind: 'dash' }
  | { kind: 'disengage' }
  | { kind: 'dodge' }
  | { kind: 'hide' }
  | { kind: 'help'; targetId: string }
  | { kind: 'use_feature'; featureId: string };
```

### Condition

```ts
type ActiveCondition = {
  id: ConditionId;
  source?: string; // e.g. 'Goblin attack', 'Failed save'
  durationRounds?: number; // undefined = until removed
};
```

### Encounter state

```ts
type EncounterState = {
  id: string;
  status: 'inactive' | 'active' | 'ended';
  combatants: Combatant[];
  turnOrder: string[]; // combatant ids in initiative order
  currentTurnIndex: number;
  round: number;
  actionsTakenThisTurn: TurnActionLog;
};

type Combatant = {
  id: string;
  refType: 'character' | 'monster';
  refId: string;
  initiative: number;
};

type TurnActionLog = {
  actionTaken: boolean;
  bonusActionTaken: boolean;
  moveUsed: number; // feet, V0 ignores this but tracks it
};
```

### GameState (the root)

```ts
type GameState = {
  characters: Record<string, Character>;
  monsters: Record<string, Monster>;
  encounter: EncounterState | null;
  scene: SceneState;
  rngSeed: number;
  eventLog: GameEvent[];
};

type SceneState = {
  id: string;
  kind: 'social' | 'exploration' | 'combat';
  description: string; // canonical fact, the LLM may not contradict
  knownFacts: string[]; // grows as scene progresses
};
```

## Public API surface

The engine exposes one entry function and a set of pure query helpers. The entry function takes a `GameState` and an `EngineRequest`, returns a new `GameState`, a list of `GameEvent`s, and an `EngineResult`.

```ts
function applyRequest(
  state: GameState,
  request: EngineRequest
): { state: GameState; events: GameEvent[]; result: EngineResult };
```

### Engine requests (LLM → engine, via orchestrator)

```ts
type EngineRequest =
  | { kind: 'roll_skill_check';
      characterId: string;
      skill: Skill;
      dc: number;
      advantage?: AdvantageState;
      reason: string;
    }
  | { kind: 'roll_saving_throw';
      characterId: string;
      ability: Ability;
      dc: number;
      advantage?: AdvantageState;
      reason: string;
    }
  | { kind: 'attack';
      attackerId: string;
      targetId: string;
      weaponId?: string;  // for PCs
      attackName?: string; // for monsters
      advantage?: AdvantageState;
    }
  | { kind: 'apply_damage';
      targetId: string;
      amount: number;
      damageType: DamageType;
      source: string;
    }
  | { kind: 'apply_condition';
      targetId: string;
      condition: ConditionId;
      source: string;
      durationRounds?: number;
    }
  | { kind: 'remove_condition';
      targetId: string;
      condition: ConditionId;
    }
  | { kind: 'use_feature';
      characterId: string;
      featureId: string;
    }
  | { kind: 'start_encounter';
      participantIds: string[];
    }
  | { kind: 'end_encounter' }
  | { kind: 'advance_turn' }
  | { kind: 'short_rest';
      characterIds: string[];
      hitDiceSpent: Record<string, number>;
    }
  | { kind: 'long_rest';
      characterIds: string[];
    }
  | { kind: 'death_save';
      characterId: string;
    }
  | { kind: 'roll_dice';
      formula: DiceFormula;
      reason: string;
    };
```

### Engine results (engine → LLM, via orchestrator)

Every result returns enough information for the LLM to narrate it accurately, including the resulting state of any affected combatant.

```ts
type EngineResult =
  | { kind: 'skill_check';
      success: boolean;
      roll: number;
      modifier: number;
      total: number;
      dc: number;
      breakdown: string; // e.g. "d20(14) + 5 = 19 vs DC 15"
    }
  | { kind: 'saving_throw';
      success: boolean;
      roll: number;
      modifier: number;
      total: number;
      dc: number;
      breakdown: string;
    }
  | { kind: 'attack';
      hit: boolean;
      critical: boolean;
      attackRoll: number;
      attackTotal: number;
      targetAc: number;
      damage?: { rolled: number; type: DamageType; breakdown: string };
      targetState: CombatantSummary;
    }
  | { kind: 'damage_applied';
      target: CombatantSummary;
      amountDealt: number; // after any reductions (none in V0)
      knockedOut: boolean; // true if HP dropped to 0
    }
  | { kind: 'condition_applied';
      target: CombatantSummary;
      condition: ConditionId;
    }
  | { kind: 'condition_removed';
      target: CombatantSummary;
      condition: ConditionId;
    }
  | { kind: 'feature_used';
      character: CharacterSummary;
      featureId: string;
      effectSummary: string;
    }
  | { kind: 'encounter_started';
      turnOrder: { combatantId: string; name: string; initiative: number }[];
    }
  | { kind: 'turn_advanced';
      currentCombatantId: string;
      currentCombatantName: string;
      round: number;
    }
  | { kind: 'encounter_ended';
      victor: 'party' | 'enemies' | 'fled' | 'neither';
    }
  | { kind: 'rest_completed';
      restType: 'short' | 'long';
      characters: CharacterSummary[];
    }
  | { kind: 'death_save';
      success: boolean;
      roll: number;
      successes: number;
      failures: number;
      stabilised: boolean;
      died: boolean;
    }
  | { kind: 'dice_roll';
      formula: DiceFormula;
      result: number;
      breakdown: string;
    }
  | { kind: 'invalid_request';
      reason: string;
      suggestion?: string; // what the LLM could try instead
    };
```

### Summaries (what the LLM sees of state)

```ts
type CombatantSummary = {
  id: string;
  name: string;
  hp: { current: number; max: number };
  conditions: ConditionId[];
  isAlive: boolean;
  isUnconscious: boolean;
};

type CharacterSummary = CombatantSummary & {
  hitDiceRemaining: number;
  featureUses: Record<string, { remaining: number; max: number }>;
  spellSlots: Record<number, number>;
};
```

### Query helpers (read-only)

```ts
function abilityModifier(score: number): number;
function getSkillModifier(character: Character, skill: Skill): number;
function getSaveModifier(character: Character, ability: Ability): number;
function getAttackModifier(character: Character, weapon: Weapon): number;
function getDamageBonus(character: Character, weapon: Weapon): number;
function isAlive(c: Character | Monster): boolean;
function isUnconscious(c: Character | Monster): boolean;
function canTakeAction(state: GameState, combatantId: string): { allowed: boolean; reason?: string };
function whoseTurn(state: GameState): string | null;
function summariseForNarrator(state: GameState): NarratorContext;
```

## JSON contract with the LLM

The LLM never imports engine types. It speaks JSON. The orchestrator is the translator.

### Direction 1: LLM → engine

After classifying player intent, the LLM produces zero or more `EngineRequest` objects in JSON. The orchestrator validates them and dispatches to the engine.

The LLM may also produce a `narration` field for response that doesn't require a mechanical resolution — pure dialogue, scene description, NPC chatter.

**Example LLM output:**

```json
{
  "engineRequests": [
    {
      "kind": "roll_skill_check",
      "characterId": "pc_kael",
      "skill": "persuasion",
      "dc": 13,
      "reason": "Convincing the innkeeper to share what she knows about the missing miller"
    }
  ],
  "narration": null,
  "needsResultBeforeNarrating": true
}
```

When `needsResultBeforeNarrating` is true, the orchestrator runs the requests, then makes a second LLM call with the results, asking only for narration. This is the standard combat / skill-check flow.

When `engineRequests` is empty and `narration` is provided, the LLM is handling pure-fiction beats (talking to an NPC, describing a room).

### Direction 2: Engine → LLM

The orchestrator wraps results in a `NarratorContext` for the second LLM call:

```json
{
  "scene": {
    "id": "scene_inn",
    "kind": "social",
    "description": "The taproom of the Ashen Stag, late evening. A peat fire smokes."
  },
  "party": [
    {
      "id": "pc_kael",
      "name": "Kael",
      "hp": { "current": 28, "max": 28 },
      "conditions": [],
      "isAlive": true,
      "isUnconscious": false
    }
  ],
  "results": [
    {
      "kind": "skill_check",
      "success": true,
      "roll": 14,
      "modifier": 1,
      "total": 15,
      "dc": 13,
      "breakdown": "d20(14) + 1 = 15 vs DC 13"
    }
  ],
  "narratorInstructions": [
    "Narrate the outcome of the skill check.",
    "Do not invent additional rolls or mechanical effects.",
    "Two to four sentences. End with a question or a hook for the next player action."
  ]
}
```

### Hard rules the orchestrator enforces

1. The LLM may not emit `apply_damage` or `apply_condition` directly without an upstream `attack` or `saving_throw` that justifies it. (For V0 this is a soft rule — log violations, don't block.)
2. The LLM's `narration` field is the only place prose may appear. No prose inside `engineRequests`.
3. If the engine returns `invalid_request`, the orchestrator may either retry the LLM with the failure information, or surface a neutral message to the player. Choice depends on the failure mode (see "Failure handling" below).
4. After narration, a post-generation validator scans the prose for forbidden patterns (numeric HP claims, dice values, slot counts) and flags or regenerates if mismatched with engine state.

## Validation rules

`applyRequest()` calls a `validateRequest()` function before any state change. Validation can return:

- `valid` — proceed
- `invalid` — return `invalid_request` with reason and (optionally) a suggestion

Validation checks include:

- Target exists and is alive (unless the action explicitly targets the dead, e.g. stabilising)
- It is the actor's turn (during encounter)
- Action economy permits the action (action / bonus action not yet taken)
- The character has the feature or weapon being used
- For spells: the slot is available at the required level (V0: always invalid, no spells castable)
- For rests: not currently in combat
- For damage / conditions: the orchestrator authorised it via an attack or save flow

## Determinism and randomness

- One PRNG instance per `GameState`. Seed is part of state. Every roll advances the seed.
- Test mode constructs a state with a fixed seed and asserts exact outcomes.
- Production mode seeds from `crypto.getRandomValues()` at session start.
- The PRNG is a xoshiro128++ implementation in `/lib/engine/rng.ts`. No external dependency.
- `Math.random()` is forbidden anywhere in `/lib/engine`. ESLint rule enforces this.

## Events and logging

Every state change emits one or more `GameEvent`s appended to `state.eventLog`. The event log is the source of truth for replay, debugging, and (in V1) campaign recap.

```ts
type GameEvent = {
  id: string;
  timestamp: number;
  type:
    | 'ROLL'
    | 'ATTACK'
    | 'DAMAGE_APPLIED'
    | 'CONDITION_APPLIED'
    | 'CONDITION_REMOVED'
    | 'FEATURE_USED'
    | 'TURN_ADVANCED'
    | 'ENCOUNTER_STARTED'
    | 'ENCOUNTER_ENDED'
    | 'REST_COMPLETED'
    | 'DEATH_SAVE'
    | 'INVALID_REQUEST';
  actorId?: string;
  payload: Record<string, unknown>;
};
```

The event log is bounded only by session duration in V0 (in-memory). In V1, events are persisted to Postgres.

## Failure handling

| Failure | Engine response | Orchestrator action |
|---|---|---|
| LLM requests an action the actor can't do | `invalid_request` with reason | Retry LLM with reason injected, max 1 retry |
| LLM requests damage without an upstream attack | `invalid_request` (V0: warning only) | Log violation, allow through |
| Target doesn't exist | `invalid_request` | Retry LLM with valid target list |
| Roll formula malformed | Throw `EngineError` | Surface generic error to player; log for fix |
| State corruption (e.g. negative HP that wasn't clamped) | Throw `EngineError` | Halt session, surface error, file bug |

## Assumptions

- One LLM provider at a time. Provider's JSON-mode or tool-use API is reliable enough that malformed JSON is rare.
- The orchestrator handles all LLM I/O. The engine never sees an LLM.
- Test coverage of the engine reaches 90%+ for V0. Combat scenarios are scripted and snapshotted.
- All SRD 5.2.1 content used is original-named (no D&D-trademarked monsters or settings).

## Decisions made

1. **Immutable state.** Reducer pattern: `applyRequest(state, request) → newState`. Easier to test and debug than mutation.
2. **Engine events are append-only.** The log is the audit trail.
3. **PRNG is seeded and part of state.** Reproducibility wins over surprise.
4. **One `applyRequest` entry point.** The full surface is the request union. No side functions that bypass validation.
5. **Damage type is recorded but not mitigated in V0.** Resistance/vulnerability/immunity arrive in V1 without schema changes.
6. **Spell slot infrastructure exists in V0 despite Fighter having none.** Adding it later would force a state schema migration; better to keep it.
7. **Theatre-of-the-mind only in V0.** No position state. The LLM may describe distance qualitatively; the engine ignores it.
8. **Action economy is tracked but mostly unenforced in V0.** Action / bonus action flags exist; the engine warns rather than blocks when the LLM tries to overspend. (Hardens in V1.)

## Open questions

- **Should the LLM see hidden monster HP?** Likely no — monsters' `hp.current` is engine-only; the LLM sees a fuzzy band ("bloodied", "wounded", "near death"). Decide before implementing `summariseForNarrator()`.
- **How are class features (e.g. Second Wind) invoked?** LLM emits `use_feature`, or the orchestrator infers from player input? Tentative: explicit `use_feature` request from the LLM.
- **Does the engine produce flavour text for crit hits?** No — it returns `critical: true` and the LLM narrates. Confirm this is comfortable.
- **Death saves: who rolls?** In V0 the engine rolls automatically each turn the PC is downed. Confirm whether a player should have to consciously trigger it.
- **Rest mechanics in a 30-minute one-shot:** is a short rest even reachable? If not, drop short-rest infrastructure from V0. Tentative: keep it; Fighter's Second Wind is a bonus-action heal, not a rest.

## Risks

- **Schema drift.** Adding fields later forces test rewrites. *Mitigation:* keep types narrow; reject scope creep in V0.
- **Hidden coupling between engine and LLM.** A future hand may add a "convenience" engine helper that takes prose. *Mitigation:* ESLint rule banning string parameters with the word "narration" or "description" in `/lib/engine/`.
- **PRNG drift.** A test passes, then a refactor changes the order of dice calls and the snapshot breaks. *Mitigation:* tests assert structure (success / damage type / hit), not exact rolls, except in dedicated determinism tests.
- **Event log size.** A long combat could produce hundreds of events. *Mitigation:* fine for V0 (in-memory, single session); revisit when persistence lands.

## Acceptance criteria

The Rules Engine Technical Spec is "done" when:

1. The data model in `types.ts` matches every type in this document. A `tsc --noEmit` passes.
2. `applyRequest()` exists with the full union of request kinds and returns the documented shape.
3. All 18 skills resolve correctly against a known character (snapshot test).
4. A full goblin-ambush encounter runs to completion in a scripted scenario test (initiative → 3+ rounds → 0 HP on one side → encounter ends).
5. A test injects a `GameState` with `pc.hp.current = 0` and asserts that an `attack` request from that PC returns `invalid_request`.
6. The engine has zero imports from `/lib/llm`. A custom lint rule enforces this.
7. Test coverage of `/lib/engine` is ≥90%, measured on the request kinds in V0.
8. A developer (not Josh) reads this spec and the engine module and can describe the LLM contract back without prompting.

## Next actions

1. Create `/lib/engine/types.ts` from the data model in this doc.
2. Create `/lib/engine/rng.ts` (xoshiro128++) and an ESLint rule banning `Math.random` inside `/lib/engine`.
3. Create `/lib/engine/index.ts` with `applyRequest` stub returning `invalid_request` for everything.
4. Implement, in order: dice → ability checks → skill checks → saves → attacks → damage → conditions → initiative → turn order → death saves → rests.
5. Write scenario tests as you go. The goblin ambush is the integration test; build toward it.
6. Then — and only then — write the **DM System Prompt Design Doc** (third doc), informed by the actual JSON contract.

## Changelog

- **v0.1 (2026-05-12):** Initial draft. Defines V0 scope, data model, public API, and LLM JSON contract.
