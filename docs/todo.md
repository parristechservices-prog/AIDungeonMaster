# Current TODO

Status source: source inspection and QA hardening on 2026-06-06. This file is the concise, current roadmap. Older design docs may describe earlier plans or target architecture; when they disagree with this file and the code, this file is newer.

## Completed In Grounded DM QA Hardening

- Player-owned AI mechanical requests require explicit `characterId`; unknown JSON keys are rejected.
- AI turns are checked by a state-aware legality validator before engine execution, with one repair attempt.
- Malformed LLM JSON receives one strict JSON-only repair attempt before a safe clarification response.
- Invalid character, monster, NPC, condition, inventory, gold, spell, spell-slot, feature, consciousness, death-save, and scene-advance requests are rejected.
- AI turns requiring results use a second narrator call. Contradictory narration is regenerated once, then replaced with engine-safe summaries.
- Core engine randomness is injectable for deterministic tests.
- Adversarial/silly-input and grounded narration tests cover the highest-risk failure modes.
- `.data/` is local-only and ignored; committed playtest/session files were removed from Git tracking.

## Highest Priority

- **Durable server persistence:** sessions currently persist to `.data/` locally and to process memory on Vercel, with a client `localStorage` snapshot for UI resume. Add KV/Postgres/Supabase or another durable store for cross-device and post-deploy resume.
- **Prompt versioning and evals:** the active DM prompt is inline in `src/lib/llm/system-prompt.ts`. Add versioned prompt files, an active prompt registry, prompt changelogs, and an eval script/CI job.
- **Safety enforcement:** grounded numeric/result contradictions are blocked or regenerated. Broader content moderation and policy classifiers remain future work.
- **Rules-engine determinism:** tests can inject deterministic randomness. Add a serializable seeded PRNG and replay format for production bug reports.
- **Turn legality and action economy:** combat works for the prototype, but movement, reactions, strict turn ownership, and action/bonus-action spending are not enforced end to end.

## Product Polish

- **Real ambient audio:** the UI honestly shows "Scene mood" and "(audio coming soon)". Add royalty-free loops, mute/volume controls, and crossfade by mood.
- **Mobile play layout:** add a sticky input bar and character-sheet drawer for phone play.
- **Failed-check UX:** mock narration gives hints, but the UI still needs inline/toast feedback for failed checks and clearer recovery choices.
- **Accessibility pass:** improve focus order, narration log semantics, screen-reader labels, and reduced-motion behavior; add automated accessibility checks.
- **Cost controls and rate limiting:** add per-session/IP turn limits, token estimation, and graceful "limit reached" messaging.

## Rules And Content Depth

- **Conditions:** basic conditions exist and some affect checks/attacks, but full SRD condition behavior, duration, save-end logic, and movement effects are incomplete.
- **Spells:** a few spells have bespoke logic. Expand to a tested SRD subset with targeting, slots, saves, damage/healing, buffs, and debuffs.
- **SRD character sheets:** expand from simple character templates to structured equipment, inventory, hit dice, proficiencies, progression, and validation.
- **Character creation and leveling:** add SRD-safe species/classes/backgrounds, ability generation, starting equipment, ASI/feat subset, and level-up rules.
- **Tactical spatial combat:** not started. Add only after the core theater-of-the-mind loop is stable.

## Module And Campaign Tooling

- **Encounter references:** planned `encounters.yaml` or equivalent encounter packs are not implemented.
- **Open5e/SRD import:** monster/spell/rules imports are planned, not shipped.
- **Authoring UX:** local JSON import exists on `/start`; a fuller scene/module editor is still future work.
- **Local-only RAG:** optional localhost PDF index/query flow is not implemented.
- **SKT/Nightstone fidelity:** committed templates are original placeholders. Private modules still need Josh-authored notes to match the owned book.

## Longer-Term

- Multiplayer rooms/WebSockets.
- Private DM whispers/secrets.
- Host succession.
- Voice input/output.
- User accounts, billing, and analytics dashboards.
- House rules/homebrew support.
