# 10 Ways to Improve AIDungeonMaster

> Status as of 2026-06-02. Use `docs/todo.md` for the immediate implementation backlog. "Implemented" means a usable version exists in the app; "Partial" means a visible feature or backend slice still needs polish.

## 1. Immersive Ambient Audio System - Partial

**Concept:** Add a dynamic soundscape engine that responds to the narrative state.

**Current:** LLM turns can set `ambient`, and the play UI shows a scene mood indicator through `AmbientAudio.tsx`. It explicitly says audio is coming soon.

**Next:** Add royalty-free loops, Web Audio crossfades, mute/volume controls, and stored preferences.

## 2. Appeal The DM - Implemented For V0

**Concept:** Give players a safety valve when the AI makes a mechanical or narrative error.

**Current:** The system prompt recognizes `[APPEAL]`, the feature flag is enabled, and the play screen has an appeal button that sends a guided appeal message.

**Next:** Add richer appeal state, optional retcon tracking, and better UI for reviewing the ruling under dispute.

## 3. Tactical Spatial Combat Grid - Planned

**Concept:** Move beyond theater-of-the-mind for complex encounters.

**Current:** Not implemented. Combat does not track grid positions, movement, line of sight, cover, or area effects.

**Next:** Add engine-owned spatial state only after action economy and conditions are more complete.

## 4. DM Persona Profiles - Implemented

**Concept:** Let players customize narrator tone.

**Current:** `/start` exposes persona choices, and `buildSystemPrompt` injects the selected persona.

**Next:** Add prompt evals per persona so tone changes do not break mechanics.

## 5. Multiplayer Session Support - Planned

**Concept:** Expand from solo/party-on-one-device play to group play.

**Current:** The start screen can create a party of up to 4 character templates, but there are no rooms, accounts, WebSockets, separate player clients, whispers, or host controls.

**Next:** Add real-time room state, player identities, action queueing, and private channels.

## 6. Physical Dice Integration - Implemented For Core Rolls

**Concept:** Let players roll real dice and enter the natural d20 result.

**Current:** `physicalDice` is feature-flagged on, the play UI has a physical dice toggle, `ManualRollModal` collects d20 results, and the engine can resolve skill checks, attacks, and death saves from manual rolls.

**Next:** Harden pending-turn recovery, add clearer validation for advantage/disadvantage entries, and test more multi-request edge cases.

## 7. Smart Canon Log Summarization - Partial

**Concept:** Reduce long-context drift by summarizing older canon facts.

**Current:** `/api/turn` calls `summarizeCanonLog` when the canon log grows, preserving high-priority facts and summarizing lower-priority facts through the configured LLM if available. Without credentials, facts are left unchanged.

**Next:** Make summarization deterministic/testable, add prompt versioning, and protect against losing important medium-priority facts.

## 8. Automated Encounter Balancer - Partial

**Concept:** Generate balanced combat from rules-owned monster data instead of relying on the LLM.

**Current:** `buildBalancedEncounter` exists and module adventure encounters can auto-spawn from preferred monster templates and difficulty. The algorithm is simple and uses a small local monster library.

**Next:** Import a broader SRD/Open5e monster set, add tests for XP thresholds and party size, and support encounter packs.

## 9. Interactive Tutorial Adventure - Implemented For V0

**Concept:** Teach new players how to talk, investigate, and fight.

**Current:** A `tutorial` scenario exists with social, exploration, and combat scenes, choices, NPC guidance, and mock DCs. The play page also has an onboarding banner.

**Next:** Add stronger first-run guidance, inline failed-check help, and completion metrics.

## 10. Rich Session Recaps - Partial

**Concept:** Preserve continuity and give players a souvenir of the session.

**Current:** Turns save recap objects, `/api/recap` exposes the latest recap, and the play UI can export a Markdown recap including party status and canon facts.

**Next:** Add durable recap storage in production, richer ending summaries, and shareable links after cloud persistence exists.
