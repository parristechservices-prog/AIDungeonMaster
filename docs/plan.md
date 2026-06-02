SRD-Only 5e Completion Plan

Goal And Constraints





Implement missing 5e support using SRD content only (safe for repo and deployment).



Preserve current architecture: deterministic engine for mechanics, narration layer for flavor.



Keep non-SRD book content out of committed sources.

Current Baseline To Build On





Existing adventure/module system and private module flow.



Existing turn/combat engine with partial actions and monster templates.



Existing session bootstrap/start flow and play loop.

Phase 1 (First Milestone): Character Sheets + Inventory + Save/Load





Expand player state model to represent a proper SRD sheet:





Identity, class/level progression, ability scores/modifiers, proficiency bonus



HP, hit dice, AC, initiative, speed, passive scores



Skills/saves proficiency/expertise flags



Conditions, resources, death saves



Equipment, currency, attunement slots, encumbrance mode



Add structured inventory model:





Item catalog ids + quantities + equipped/worn states



Weapon/armor/shield hooks used by engine calculations



Introduce persistence boundary for sessions/sheets:





Local-first persistence abstraction (browser storage) with migration versioning



Explicit load/save lifecycle in start/play APIs



Ship usable sheet UI in start/play:





Read/write sheet panel



Inventory management and equip/unequip



Validation + migration errors surfaced to user



Add recap/export payload extensions to include sheet and inventory state snapshots.

Phase 2: Complete SRD Character Creation + Leveling





Add SRD races/subraces and class/subclass progression data tables.



Add full builder pipeline:





Race/class/background choices



Ability score generation methods



Starting proficiencies, equipment packs, languages, tools



Add level-up engine:





ASI/feat (SRD subset), HP gains, spellcasting progression



Class features per level



Add validation rules to prevent illegal builds and invalid respecs.

Phase 3: Combat, Actions, Spells, Conditions (SRD-complete)





Normalize combat action economy:





Action/bonus action/reaction/movement handling



Opportunity attacks, ready/help/dodge/disengage/grapple/shove rules



Implement SRD condition system end-to-end with duration and save-end logic.



Add SRD spell framework:





Spell data registry



Casting checks, slots/preparation/known spells



Targeting/resolution hooks (damage, healing, buffs, debuffs, utility)



Extend monster and NPC statblock handling to SRD-complete fields.

Phase 4: DM/Module Tooling (SRD-safe)





Expand module schema to support:





Encounter packs, treasure tables, handouts, boxed text placeholders



Rule-linked encounter scripting and validation



Add import validators for SRD-safe JSON bundles.



Improve start-page module UX for larger campaign catalogs and filtering.

Phase 5: Quality, Balance, And Operational Hardening





Add broad automated test coverage:





Rule unit tests (math/proficiencies/spell effects)



Integration tests for full turn flows and state transitions



Golden tests for representative SRD encounters



Add save schema migration tests and backward-compat checks.



Add instrumentation and debug tooling for deterministic replay of rules bugs.

Architecture Track (Across All Phases)

flowchart LR
  playerUI[PlayerUI] --> sessionAPI[SessionAndTurnAPIs]
  sessionAPI --> rulesEngine[DeterministicRulesEngine]
  sessionAPI --> narrationLayer[NarrationLayer]
  rulesEngine --> stateStore[SheetAndCombatStateStore]
  stateStore --> localPersist[LocalPersistenceWithMigrations]
  rulesEngine --> srdData[SRDContentRegistries]
  narrationLayer --> promptComposer[PromptComposer]
  promptComposer --> moduleData[AdventureModuleData]

Primary Files/Areas Expected To Change





Start/play UI flows: C:/Users/joshu_w0zb8cp/Projects/AIDungeonMaster/src/app/start/page.tsx, C:/Users/joshu_w0zb8cp/Projects/AIDungeonMaster/src/app/play/page.tsx



Session/turn APIs: src/app/api/session/*, src/app/api/turn/route.ts



Core rules state and progression: src/lib/game/state.ts, src/lib/game/characters/*, src/lib/game/engine/*



Adventure/module schema and loaders: src/lib/game/adventures/*



Persistence layer: src/lib/persistence/*



Tests: src/test/*

Delivery Strategy





Implement each phase in small PR-sized slices with passing tests/build per slice.



Keep backward compatibility by adding state versioning and migration gates before major schema changes.



Use feature flags where needed to avoid breaking current gameplay while expanding systems.

