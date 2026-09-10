# Current TODO

> **September 2026 refresh:** the ranked source of truth is
> [`open-threads.md`](open-threads.md). This file remains the historical register, but this
> section captures the current development program so the older backlog is not mistaken for
> current code state.

## September 2026 priority program

The engine is no longer the main weakness. AIDM already has substantial deterministic
combat/spatial mechanics, AI legality validation, narration validation, source-lore retrieval,
canon memory and Postgres-capable persistence. The main gap is that the **player-facing AI
experience, character/spell progression, persistent campaign structure and production
reliability have not fully caught up with those foundations**.

### Ranked priorities

1. **Production AI reliability** — verify the 2026-09-06 Groq model fix is live, keep AI
   Director as the normal production path, add live-provider smoke tests, safe provider/model
   diagnostics and useful fallback behaviour.
2. **Free-form player intent** — ordinary questions/observations/conversation such as
   `Describe the village`, `What can I see?` and `Ask Mira about the courier` must not become
   arbitrary skill checks. Roll only for genuinely uncertain actions.
3. **Production persistence** — verify Postgres/Supabase configuration and migrations in
   production, then test cold starts, redeploys, cross-device resume and campaign browsing.
4. **Real 1→20 character progression** — XP/milestones, level-up UI, class features,
   resources, extra attacks, ASIs/feat subset, hit dice, equipment/proficiencies and spell
   progression.
5. **SRD-safe spell system** — replace the tiny bespoke mechanically recognised spell set
   with a tested catalogue covering targeting, slots, saves, attack rolls, damage/healing,
   concentration, durations, buffs and debuffs.
6. **Conditions/deeper rules** — duration/save-end logic, concentration, damage
   resistance/vulnerability/immunity, monster multiattack, additional reactions,
   Huge/Gargantuan footprints, creature-as-cover and flying/3D movement.
7. **Persistent open-world campaigns** — structured quests, factions, NPC relationships,
   schedules/promises, rumours, world time, dynamic encounters, durable unresolved threads
   and memory policies that retain important facts over hundreds of turns.
8. **Scenario/world structure** — move beyond the mostly linear
   `social → exploration → combat → ending` shape into branching campaigns with concurrent
   objectives, optional content, return visits and consequences; replace log-keyword
   scene-success heuristics with structured events/flags.
9. **DM quality/evals** — prompt registry/changelog, broader eval fixtures, persona
   continuity and explicit evaluation of repetition, railroading and boring responses.
10. **UX/accessibility** — mobile sticky composer, character-sheet drawer, better
    spell/inventory interactions, failed-check recovery, clearer exploration affordances,
    focus/live-region/screen-reader/reduced-motion coverage.
11. **Ops/cost/observability** — distributed rate limits, budgets, token/cost telemetry,
    provider/key/model health, graceful 429/busy handling, alerts and replayable seeded bug
    reports.
12. **Large product features** — voice I/O, multiplayer/WebSockets, private whispers,
    accounts, billing/analytics, homebrew/house rules, host succession and richer AFK/network
    recovery.

### Five milestones

#### Milestone 1 — Make production trustworthy

- verify Vercel is serving the post-2026-09-06 Groq model fix;
- prove AI Director is the normal production path;
- add live-provider smoke/canary coverage;
- surface provider/model/key failures without exposing secrets;
- keep Table Rules as an intentional safe fallback rather than a silent quality cliff;
- regression-test the exact `Describe the village` failure;
- verify `/api/health`, build SHA, storage mode and prompt/model status in production.

#### Milestone 2 — Make every natural-language action behave sensibly

- distinguish narration-only questions/observations/conversation from uncertain checks;
- only roll when an outcome is genuinely uncertain;
- preserve open-ended/weird player actions;
- expand paraphrase/adversarial prompt banks;
- make deterministic fallback follow the same intent principles as AI Director.

#### Milestone 3 — Make campaigns persistent

- verify production Postgres configuration and migrations;
- test cold-start and redeploy persistence;
- add cross-device resume and campaign list/browser;
- formalise save migrations;
- recover safely from temporary storage failure.

#### Milestone 4 — Character and spell progression

- proper level 1→20 progression;
- SRD-safe character creation breadth;
- class feature/resource unlocks;
- spell catalogue and class/level legality;
- concentration/duration/save mechanics;
- better character/inventory/spell UI;
- representative progression regression tests for every supported class.

#### Milestone 5 — Persistent open-world campaign engine

- structured quests and concurrent objectives;
- factions/reputation;
- durable NPC relationships, promises and schedules;
- world time, travel and timed events;
- dynamic encounters;
- long-term memory that retains important facts;
- branching campaigns that let players ignore or abandon the authored quest.

### Deeper engine work after the immediate AI/product milestones

- Huge/Gargantuan footprints;
- creature-as-cover and exact corner tracing where needed;
- proper flying/3D pathfinding;
- monster multiattack;
- damage type resistance/vulnerability/immunity;
- concentration;
- saving-throw spells;
- reactions beyond opportunity attacks;
- selected exhaustion/inspiration/encumbrance rules.

### Long-term world model target

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

The LLM may create and interpret possibilities, but structured state must own established
truth so campaigns survive long sessions, model changes, cold starts and redeployments.

### Recently completed/materially advanced

- Postgres-backed session and recap storage exists with memory fallback.
- Area-graph exploration and advanced tactical spatial systems exist.
- Engine/narrator separation plus legality/repair/narration validation is in place.
- Source-lore RAG/gazetteer and structured canon memory are in place.
- Death-save, crit/damage, combat auto-start and seeded-targeting fixes landed previously.
- Tactical opportunity attacks, cover, authored terrain, monster spatial symmetry and Large
  footprints have materially advanced the spatial engine.
- **2026-09-06:** Vercel build failures caused by missing `end_turn` / `complete_objective`
  request-union members were fixed on `main`.
- **2026-09-06:** retired Groq default model IDs were replaced after they caused every AI
  Director request to return `model_not_found` and silently fall back to Table Rules. Current
  Groq models were verified with structured JSON and free-form narration.

---

## Historical register preserved below

> **⚠️ Superseded (2026-06-20):** The single ranked source of truth is now
> [`open-threads.md`](open-threads.md). This historical section is preserved to show what was
> known at the time. Items marked **[STALE — …]** were advanced or shipped later.

## Shipped since this register (2026-06-20 session)

- Death saves on damage to downed characters (engine).
- Seeded RNG for `monster_turn` target selection (completes engine determinism for
  combat targeting; serializable seed + replay format still open).
- Combat auto-starts when attacking a living enemy out of combat; weapon/monster
  damage dice and crit-on-kept-die fixes.
- Multi-attempt self-healing narration validator.
- Source-lore RAG over the owned book: chunked index, hierarchical + heading-aware +
  conversation-aware retrieval, anti-invention guardrail, ~390-entry gazetteer,
  served from Vercel Blob (book text out of git). Mitigates long-context drift.
- SKT/Nightstone fidelity canon added to the templates (keep bridge + survivors,
  inn/Kella, special-event NPCs, bell-ringers).
- Decided against a native Anthropic provider — Groq stays the core brain.

Status source: source inspection and QA hardening on 2026-06-06. Older design docs may
therefore describe target states that later changed.

## Completed In Grounded DM QA Hardening

- Player-owned AI mechanical requests require explicit `characterId`; unknown JSON keys are rejected.
- AI turns are checked by a state-aware legality validator before engine execution, with one repair attempt.
- Malformed LLM JSON receives one strict JSON-only repair attempt before a safe clarification response.
- Invalid character, monster, NPC, condition, inventory, gold, spell, spell-slot, feature, consciousness, death-save, and scene-advance requests are rejected.
- AI turns requiring results use a second narrator call. Contradictory narration is regenerated once, then replaced with engine-safe summaries.
- Core engine randomness is injectable for deterministic tests.
- Adversarial/silly-input and grounded narration tests cover the highest-risk failure modes.
- `.data/` is local-only and ignored; committed playtest/session files were removed from Git tracking.

## Historical Highest Priority

- **Durable server persistence:** originally process/file-memory only; later Postgres-backed storage was implemented and now requires production verification and UX completion.
- **Prompt versioning and evals:** versioning/eval infrastructure has advanced; keep expanding fixtures and production canaries.
- **Safety enforcement:** grounded numeric/result contradictions are blocked or regenerated. Broader content moderation remains a future product decision.
- **Rules-engine determinism:** injectable randomness exists; serializable seed + replay remains open.
- **Turn legality and action economy:** movement/reactions/spatial rules advanced heavily; continue strict turn ownership and full action/bonus-action enforcement.

## Historical Product Polish

- **Real ambient audio:** add royalty-free loops, mute/volume controls, and crossfade by mood.
- **Mobile play layout:** continue sticky input and character-sheet drawer improvements.
- **Failed-check UX:** continue inline/toast feedback and clearer recovery choices.
- **Accessibility pass:** focus order, narration log semantics, screen-reader labels, reduced-motion behavior and automated checks.
- **Cost controls and rate limiting:** strengthen per-session/IP/storage-backed limits, token estimation and graceful limit messaging.

## Historical Rules And Content Depth

- **Conditions:** expand duration, save-end logic and movement effects.
- **Spells:** expand to a tested SRD subset with targeting, slots, saves, damage/healing, buffs and debuffs.
- **SRD character sheets:** structured equipment, inventory, hit dice, proficiencies, progression and validation.
- **Character creation and leveling:** SRD-safe species/classes/backgrounds, ability generation, starting equipment, ASI/feat subset and level-up rules.
- **Tactical spatial combat:** now substantially implemented; see `spatial-awareness-roadmap.md` for current state rather than this old line item.

## Historical Module And Campaign Tooling

- **Encounter references:** planned `encounters.yaml` or equivalent encounter packs.
- **Open5e/SRD import:** monster/spell/rules import pipeline remains useful.
- **Authoring UX:** local JSON import exists; fuller scene/module editor remains future work.
- **Local-only RAG:** source-lore RAG later shipped in a different production-oriented form; localhost PDF workflow remains optional/future.
- **SKT/Nightstone fidelity:** templates and retrieval were later materially improved; continue keeping licensed source text private.

## Longer-Term

- Multiplayer rooms/WebSockets.
- Private DM whispers/secrets.
- Host succession.
- Voice input/output.
- User accounts, billing, and analytics dashboards.
- House rules/homebrew support.
