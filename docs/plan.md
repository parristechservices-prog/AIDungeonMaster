---
doc: Product plan (historical)
project: PartyQuest / AIDungeonMaster
date: 2026-06-02
status: historical plan
audience: developers, coding agents
---

# Product plan

> This document records the original product plan and delivery phases for AIDungeonMaster as of 2026-06-02. It is a historical reference. Use `docs/todo.md` for the current implementation backlog and `docs/full-improvement-plan.md` for the active roadmap.

## Purpose

Capture the high-level project goals, architecture assumptions, and phased delivery plan for the hybrid engine + LLM tabletop RPG prototype.

## Baseline

- The repo already has an adventure/module registry, private module support, and validations.
- The turn/combat engine exists with partial skills, attacks, features, rests, spells, conditions, physical dice, and simple encounter balancing.
- The start/play UI exists with character templates, party setup, backgrounds, personas, choices, dice display, combat HUD, appeal, mood indicator, recap export, and local client snapshots.
- Local dev persistence writes `.data/session-*.json`. Vercel persistence remains process memory.

## Phase 1: Character sheets, inventory, save/load

- Model SRD character sheets with abilities, proficiencies, HP, hit dice, AC, initiative, speed, passive scores, conditions, resources, and equipment.
- Replace string-based inventory with structured item ids, quantities, equipped state, and validation.
- Add a persistence boundary with schema versioning and migrations.
- Improve start/play sheet UI for equipment management and validation errors.
- Include sheet and inventory state in recap/export payloads.

## Phase 2: Character creation and leveling

- Add SRD-safe species, classes/subclasses, backgrounds, proficiencies, languages, tools, and equipment data.
- Build a character creation flow with ability-score options and legal starting builds.
- Add level-up mechanics, including ASI/feat subset and spell-slot progression.
- Add validation to prevent illegal builds and invalid respecs.

## Phase 3: Combat, actions, spells, conditions

- Normalize action economy and legal timing for actions, bonus actions, reactions, and movement.
- Add supported SRD actions such as ready, help, disengage, dodge, and grapple-related options.
- Implement condition behavior end to end with durations and save-end resolution.
- Build a spell framework with casting validation, targeting, saves, and effect resolution.
- Extend monster and NPC stat blocks with more complete SRD fields.

## Phase 4: DM and module tooling

- Add encounter pack and treasure table support.
- Add handout metadata, boxed text placeholders, and module validations.
- Support SRD-safe JSON bundle imports and richer module UX.
- Improve start-page filtering and private/template badges.

## Phase 5: Quality and hardening

- Add broad automated tests for rules, conditions, spells, and turn flows.
- Add integration and golden tests for representative scenarios.
- Add save schema migration tests and deterministic replay tooling.
- Replace `Math.random()` with a seedable PRNG for deterministic tests.
- Add end-to-end play tests.

## Delivery strategy

- Break work into small, testable slices.
- Add state versioning and migration gates before schema changes.
- Use feature flags to protect current gameplay during expansion.

## Notes

This plan is historical. The current implementation backlog is in `docs/todo.md`.
