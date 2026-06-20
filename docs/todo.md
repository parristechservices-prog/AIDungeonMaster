# Current TODO

> **⚠️ Superseded (2026-06-20):** The single ranked source of truth is now
> [`open-threads.md`](open-threads.md). This file is kept for history. Items marked
> **[STALE — …]** below were advanced or shipped in the 2026-06-20 session; the
> surrounding 2026-06-06 status text is preserved unchanged for the record.

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
- **Rules-engine determinism:** tests can inject deterministic randomness. Add a serializable seeded PRNG and replay format for production bug reports. **[STALE — advanced 2026-06-20:** `monster_turn` target selection now uses the injectable provider too (no stray `Math.random`); a serializable seed + replay format is still open.**]**
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
- **Local-only RAG:** optional localhost PDF index/query flow is not implemented. **[STALE — partially shipped 2026-06-20:** a source-lore RAG (chunked index + gazetteer over the owned book, served from Vercel Blob) now exists; the specific localhost-PDF index/query variant is still unbuilt.**]**
- **SKT/Nightstone fidelity:** committed templates are original placeholders. Private modules still need Josh-authored notes to match the owned book. **[STALE — advanced 2026-06-20:** templates now carry SKT canon (keep, inn/Kella, special events, bell-ringers) and the source-lore index grounds detail; deeper private notes remain the long-term path.**]**

## Longer-Term

- Multiplayer rooms/WebSockets.
- Private DM whispers/secrets.
- Host succession.
- Voice input/output.
- User accounts, billing, and analytics dashboards.
- House rules/homebrew support.
