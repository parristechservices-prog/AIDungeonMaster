# Open Threads & Roadmap — Single Source of Truth

Updated: 2026-09-06

This is the **consolidated, ranked backlog** for AIDM. It supersedes older status text in
`todo.md`, `current-risk-register.md`, `ai-dm-app-gaps-and-next-steps.md`, and
`full-improvement-plan.md` when they disagree with current code.

Goal: **a production-scale, persistent, open-world AI Dungeon Master** where:

1. **Rules engine** owns dice, HP, AC, legality, combat, movement and resources.
2. **State tracker** owns persistent world truth, characters, NPCs, quests and memory.
3. **Spatial model** owns where actors can actually be and what they can perceive/reach.
4. **LLM DM** interprets free-form player intent and narrates only engine-confirmed outcomes.

The architecture is already strong. The main remaining job is making the **player-facing AI
experience, progression depth, persistent campaign state and production reliability catch up
with the sophistication of the engine**.

Legend — Impact: 🔴 high · 🟠 medium · 🟡 lower/longer-term. Effort: 🏔️ large · ⛰️ medium · 🪨 small.

---

## A. Ranked priorities

| # | Area | Current state | What remains | Impact | Effort |
|---|---|---|---|---|---|
| 1 | **Production AI reliability** | Groq + backup keys + structured LLM turns exist. On 2026-09-06 the decommissioned Groq model defaults were identified as the root cause of AI Director silently falling back to Table Rules, and `main` was updated to current Groq models. | Verify the new production deployment end-to-end, keep a live-provider smoke test, expose provider/model failure diagnostics safely, distinguish expected fallback from provider failure, and keep fallback behaviour useful instead of brittle. | 🔴 | ⛰️ |
| 2 | **Free-form player intent** | AI path supports structured engine requests; deterministic fallback exists. | Questions, observations and ordinary conversation (for example `Describe the village`, `What can I see?`, `Ask Mira about the courier`) must never default to arbitrary Investigation checks. Classify narration-only intent vs uncertain checks vs mechanical actions, with regression fixtures for natural phrasing. | 🔴 | ⛰️ |
| 3 | **Production persistence and campaign resume** | Postgres/Supabase-backed session + recap storage exists in code with in-memory fallback. | Verify `DATABASE_URL` and migrations in production, test cold starts/deploys/cross-device resume, make failures observable, and expose a proper campaign browser/cloud-save UX. | 🔴 | ⛰️ |
| 4 | **Real character progression** | Character templates, resources and level scaling exist; six useful templates are already present. | Implement real 1→20 progression: XP/milestones, level-up flow, class features, extra attacks, ASIs/feat subset, hit dice, proficiency/equipment progression and spell progression. | 🔴 | 🏔️ |
| 5 | **SRD spell system** | Generic `cast_spell`, slot accounting and known-spell validation exist; only a small bespoke spell subset has full mechanics. | Import/use a tested SRD-safe spell catalogue with targeting, attack/save resolution, damage/healing, concentration, durations, buffs/debuffs and class/level legality. Reuse the cleaned open-licensed SRD data pipeline where practical rather than maintaining tiny hard-coded lists. | 🔴 | 🏔️ |
| 6 | **Conditions and deeper rules** | Conditions, advantage/disadvantage, spatial combat, death saves, rests and core attack rules exist. | Complete condition duration/end logic, concentration, saving-throw spells, damage types/resistance/vulnerability/immunity, monster multiattack, additional reactions, Huge/Gargantuan footprints, creature-as-cover, flying/3D movement and selected exhaustion/inspiration/encumbrance rules. | 🔴 | 🏔️ |
| 7 | **Persistent open-world campaigns** | Canon log, recaps, NPC records, exploration areas and source-lore retrieval exist. | Add durable quests, factions, NPC relationships/schedules, rumours, world time, dynamic encounters, unresolved-thread tracking and memory policies that retain important obligations/facts over hundreds of turns. | 🟠 | 🏔️ |
| 8 | **Scenario/world structure** | Authored one-shots and area graphs are strong. | Move beyond a mostly linear `social → exploration → combat → ending` shape into branching campaigns with concurrent objectives, optional content, return visits and consequences. Replace scene-success log-keyword heuristics with structured flags/events. | 🟠 | 🏔️ |
| 9 | **DM quality, prompt versioning and evals** | Strict schemas, repair, legality validation, narration validation and offline prompt evals exist. | Maintain versioned prompt registry/changelog, broaden eval fixtures, measure repetition/railroading/boring responses, test DM persona continuity, and include live-provider canary tests without making CI depend on external APIs. | 🟠 | ⛰️ |
| 10 | **UX and accessibility** | Combat HUD, map, character sheet, suggested actions, physical dice and DM appeal exist. | Improve mobile layout/sticky composer, character-sheet drawer, spell/inventory interactions, failed-check recovery, exploration affordances, focus order, live-region semantics, screen-reader labels and reduced-motion coverage. | 🟠 | ⛰️ |
| 11 | **Ops, cost and observability** | Health endpoint, turn-cap scaffolding and provider failover pieces exist. | Add storage-backed/distributed rate limits, per-session/user budgets, token/cost telemetry, provider/key/model health visibility, graceful 429/busy state, replayable seeded bug reports and production alerts. | 🟠 | ⛰️ |
| 12 | **Large product features** | Feature flags exist. | Voice input/output, multiplayer rooms/WebSockets, private whispers/secrets, user accounts, billing/analytics dashboards, house rules/homebrew, host succession and richer AFK/network recovery. | 🟡 | 🏔️ |

---

## B. What is already strong and should not be rewritten

AIDM already has a substantial deterministic engine. Preserve and extend it rather than
replacing it with prompt-only logic.

Implemented/strong areas include:

- attacks vs AC, damage application and critical-hit handling;
- skill checks and injectable randomness for deterministic tests;
- death saves and unconscious/downed handling;
- short/long rests and resource restoration;
- spell-slot accounting and selected spell mechanics;
- conditions that already influence checks/attacks;
- square-grid tactical state and engine-owned movement;
- Dash, Disengage and opportunity attacks with reaction consumption;
- difficult terrain, blocked/occupied cells and movement cost/pathfinding;
- melee reach, ranged range, LOS, half/three-quarter/total cover;
- elevation/falling support;
- authored terrain;
- deterministic monster movement/targeting and ranged/melee/reach metadata;
- Large 2×2 creature footprints;
- narration-vs-state drift checking;
- state-aware legality validation and repair before engine execution;
- source-lore RAG/gazetteer support and structured canon memory.

### Deeper engine/rules follow-ups

These are important but should come **after production AI reliability and natural-language
intent handling are trustworthy**:

- Huge/Gargantuan footprints;
- creature-as-cover and exact corner tracing if a visible grid needs it;
- proper flying/3D pathfinding and movement cost;
- monster multiattack;
- damage type resistance/vulnerability/immunity;
- concentration;
- saving-throw spells;
- reactions beyond opportunity attacks;
- fuller exhaustion/inspiration/encumbrance support.

---

## C. Character progression target

Level should change what a character can actually do, not merely scale numbers.

Target 1→20 progression includes:

- proficiency bonus and HP/hit-die progression;
- class feature unlocks and feature-use/recharge rules;
- extra attacks where appropriate;
- spell slots and spell access by class/level;
- ASIs and a safe feat subset;
- equipment/proficiency validation;
- level-up UI and migration-safe save updates;
- XP and/or milestone advancement with protection against duplicate level grants.

Existing Fighter, Wizard, Rogue, Cleric, Paladin and Ranger templates should become the
first fully verified progression paths before adding breadth for breadth's sake.

---

## D. Spell and condition depth

The generic spell request/slot framework is useful, but the mechanically recognised spell
catalogue is still much smaller than a real campaign needs.

Build toward a tested SRD-safe subset with:

- spell catalogue and class/level lookup;
- targeting and range;
- attack-roll and saving-throw spells;
- damage/healing;
- concentration;
- duration and save-end logic;
- buffs/debuffs and conditions;
- AoE where the spatial model can resolve it;
- validation that unknown/unprepared/slotless casts cannot mutate state;
- narration validation against the resolved result.

---

## E. Persistent open-world campaign target

The long-term world model should support:

**World**
→ regions
→ towns / dungeons / wilderness
→ locations
→ persistent NPCs
→ factions
→ quests and rumours
→ time
→ encounters
→ relationships
→ consequences

The LLM may generate and interpret possibilities, but structured state must own established
truth so the world can survive model changes, cold starts and long campaigns.

Open-world follow-ups:

- persistent quest objects with statuses/objectives/dependencies;
- faction reputation and faction-to-faction relationships;
- NPC relationship state, schedules, promises and unresolved obligations;
- world clock, travel time and timed events;
- encounter generation/balancing tied to location and party state;
- durable important-fact retention across 100–300+ turns;
- campaign browser/resume across devices;
- branching and simultaneous objectives instead of one active thread only;
- downtime/crafting/weird asks/homebrew as later extensions.

---

## F. Five-milestone development program

### Milestone 1 — Make production trustworthy

- verify the 2026-09-06 Groq model fix is live on Vercel;
- prove AI Director is the normal production path;
- add live-provider smoke/canary coverage;
- make provider/model/key failure reasons observable without leaking secrets;
- make Table Rules an intentional safe fallback, not a silent quality cliff;
- regression-test the exact `Describe the village` playthrough failure;
- verify `/api/health`, build SHA, storage mode and prompt/model status on production.

### Milestone 2 — Make every natural-language action behave sensibly

- classify narration-only questions/observations/conversation separately from uncertain checks;
- only roll when the player attempts something whose outcome is genuinely uncertain;
- preserve open-ended actions and weird asks;
- expand adversarial and paraphrase prompt banks;
- ensure fallback mode follows the same intent principles as AI Director.

### Milestone 3 — Make campaigns truly persistent

- verify production Postgres configuration/migrations;
- cold-start and redeploy persistence tests;
- cross-device resume;
- campaign list/browser;
- migration ladder for old saves;
- safe recovery when storage is temporarily unavailable.

### Milestone 4 — Character and spell progression

- real level 1→20 progression;
- SRD-safe character creation breadth;
- class features/resources;
- spell catalogue + class/level legality;
- concentration/duration/save mechanics;
- improved character, inventory and spell UI;
- regression fixtures for every supported class at representative levels.

### Milestone 5 — Persistent open-world campaign engine

- structured quests and concurrent objectives;
- factions/reputation;
- durable NPC relationships and promises;
- world time/travel/timed events;
- dynamic encounters;
- long-term memory that retains important facts;
- branching campaigns that support ignoring or abandoning the authored quest.

After these milestones, prioritise deeper rules edge cases, voice, multiplayer, accounts,
homebrew and other large product surfaces.

---

## G. Product polish and tooling

### Product polish

- ambient audio loops, mute/volume and mood crossfade;
- mobile sticky input and character-sheet drawer;
- clearer failed-check recovery choices;
- inventory/spell/resource interfaces;
- accessibility automation and manual screen-reader pass;
- cold-start/Begin experience;
- better network-drop/retry state.

### Module/campaign tooling

- encounter packs (`encounters.yaml` or equivalent);
- SRD/Open5e-safe monster/spell/rules import pipeline;
- fuller local authoring/editor UX;
- one-command index + gazetteer regeneration;
- gazetteer extraction/OCR-variant polish;
- continue legal separation of private owned-book text from the public repository.

### Longer-term

- multiplayer rooms/WebSockets;
- private DM whispers/secrets/PvP handling;
- voice input/output;
- user accounts, billing and analytics;
- host succession;
- house rules/homebrew;
- Australian-English localisation and DM-personality continuity options.

---

## H. Immediate ops loose ends

- Verify Vercel production is actually serving the new post-`1e3491d` Groq-model fix rather
  than an older successful deployment.
- Keep preview and production environment variables aligned where intended.
- Keep API keys only in Vercel/local environment storage; rotate any credentials that have
  been exposed outside secret storage.
- Prevent concurrent agents from overwriting each other's `main` changes: fetch/rebase or
  read current file SHA immediately before each direct write.
- Add a serializable seeded PRNG/replay payload for reproducible production bug reports.

---

## Recently completed / materially advanced

- Postgres-backed session and recap storage implemented with memory fallback.
- Area-graph exploration and advanced tactical spatial model implemented.
- Engine/narrator split + multi-attempt self-healing narration validator.
- State-aware AI legality validation and repair.
- Source-lore RAG, hierarchical retrieval and canonical gazetteer.
- SKT/Nightstone grounding work while keeping licensed book text out of Git.
- Death-save fixes on damage to downed characters.
- Seeded/injectable monster target randomness.
- Tactical opportunity attacks, cover, authored terrain, monster spatial symmetry and
  Large-creature footprints.
- 2026-09-06 Vercel build type error fixed (`end_turn` / `complete_objective` request types).
- 2026-09-06 Groq defaults updated after retired model IDs caused every AI Director request
  to return `model_not_found` and silently fall back to Table Rules.

## Detailed plans

- [persistence-and-spatial-plan.md](persistence-and-spatial-plan.md)
- [spatial-awareness-roadmap.md](spatial-awareness-roadmap.md)
- [full-improvement-plan.md](full-improvement-plan.md) — historical/broad design inventory
- [todo.md](todo.md) — historical register plus September 2026 summary
