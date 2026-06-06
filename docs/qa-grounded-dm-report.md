# Grounded DM QA Report

Date: 2026-06-06

## Risks Fixed

- AI player-owned requests now require explicit character IDs and strict JSON shapes.
- State-aware validation blocks invalid party, monster, NPC, condition, feature, spell, inventory, gold, consciousness, death-save, and scene-advance requests before engine execution.
- Malformed JSON and illegal AI turns each receive one repair attempt. Failed repair returns a safe clarification instead of executing vague mechanics.
- Unknown or unlearned spells fail before consuming spell slots.
- Invalid manual d20 rolls, missing inventory removals, negative gold, missing NPCs, and missing condition targets fail safely.
- AI result-dependent turns use a second narrator call. Narration contradicting state or engine results is regenerated once, then replaced with engine-safe text.
- Engine randomness is injectable for deterministic tests.
- Tracked `.data` session and recap files were removed. `.data/` remains local-only and ignored.

## Tests Added Or Strengthened

- Required character IDs and strict schema rejection.
- Structured turn-legality errors and legal-ID repair prompts.
- Invalid IDs, unconscious actions, conscious death saves, spells, slots, inventory, gold, conditions, NPCs, and manual rolls.
- Malformed LLM JSON repair.
- Contradictory hit/miss, success/failure, HP, AC, spell-slot, and damage narration.
- Adversarial inputs including modern weapons, impossible movement, skipped treasure, invented NPCs, unsupported spells, and incoherent targets.

## Remaining Risks

- Production sessions remain process-memory-only on Vercel. Durable storage is not implemented.
- Spell support is intentionally a small bespoke subset, not a complete SRD spell engine.
- Scene success conditions are simple text/log heuristics and should eventually become structured engine flags.
- Narration safety checks target grounded mechanical contradictions; broader moderation remains future work.
- Injectable randomness supports deterministic tests, but production replay still needs a serializable seed/event log.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
```

Vercel remains configured to run `pnpm build`. Deployment verification must be checked in the Vercel dashboard unless local Vercel CLI authentication is available.
