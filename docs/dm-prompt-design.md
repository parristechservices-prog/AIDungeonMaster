---
doc: DM System Prompt Design Doc
project: PartyQuest / DM-in-a-Box
status: target design v0.1; partially implemented
owner: Josh Parris
date: 2026-05-12
audience: developers, coding agents, future Josh
companions: v0-feature-spec.md, rules-engine-spec.md
---

# DM System Prompt Design Doc — DM-in-a-Box

> **Accuracy note (2026-06-02):** This document describes the intended prompt architecture. The current code has a single inline system prompt in `src/lib/llm/system-prompt.ts`, a Zod-validated JSON turn contract in `src/lib/llm/contracts.ts`, a numeric narration warning pass in `src/lib/llm/validate-narration.ts`, and a mock/table-rules fallback. Versioned prompt files, `prompts/active.ts`, `pnpm eval:prompts`, a second narrator LLM call, and moderation-based safety regeneration are not implemented yet.

## Purpose

Define the AI half of the hybrid architecture. The rules engine owns numbers. The LLM owns words. This document specifies how the LLM is prompted, what it may and may not say, how prompts compose during a turn, how they're versioned, and how we know when a prompt change breaks something.

The hard rule running through every prompt in this doc:

> **The LLM never invents numbers. HP, AC, dice, slots, and damage all come from the engine. The LLM only narrates what the engine returns.**

If a prompt change weakens that rule, the prompt change is wrong.

## Scope (V0)

This doc covers V0 only — the solo, text-only, 30-minute one-shot defined in `v0-feature-spec.md`, against the engine contract in `rules-engine-spec.md`.

### In scope

- The full prompt stack for a player turn
- The DM persona system prompt (v0.1, written in full)
- The Narrator prompt (v0.1, written in full)
- The Safety Validator (v0.1, described with implementation notes)
- Versioning convention and changelog format
- Eval / regression suite for prompt changes
- One tone variant: **Heroic** (default and only V0 tone)
- Failure handling when the LLM emits malformed JSON or invents numbers

### Explicitly out of scope (V0)

- Multiple tone variants (grim, comedic, family-friendly) — written about, not shipped
- Session 0 wizard prompt (no UI in V0)
- X-card mid-session preference changes
- NPC voice variation
- Multi-language prompts (English only)
- Whisper / private DM-to-player asides (no multiplayer in V0)
- "Previously on…" recap prompt (no campaign continuity)
- Adventure generator prompt (V0 adventure is hand-authored)
- Image generation prompts

## The prompt stack

A player turn runs at most two LLM calls. Three if the safety validator flags a regeneration.

```
player input
    │
    ▼
[1] DM main call ──► JSON: { engineRequests, narration, needsResultBeforeNarrating }
    │
    ├── narration only ──► [3] safety validator ──► player sees prose
    │
    └── engineRequests present
            │
            ▼
        orchestrator runs each request through the engine
            │
            ▼
        engine returns EngineResult[]
            │
            ▼
    [2] Narrator call ──► narration prose
            │
            ▼
        [3] safety validator ──► player sees prose
```

Three prompts only. V0 deliberately collapses the gaps document's five-layer model (intent classifier, skill adjudicator, narrator, safety, world keeper) because a single modern LLM call handles intent + adjudication in one pass at lower cost. The layered model returns in V1 when scale and quality demand it.

### Why two LLM calls per turn, not one

The DM main call decides *what should happen mechanically*. The narrator call describes *what happened*. Splitting them serves two purposes:

1. The narrator sees the *actual* engine results, not the LLM's expectation of them. This prevents "I attack the goblin" → LLM hopes for a hit → LLM narrates a hit → engine actually rolled a miss → narration contradicts engine.
2. The narrator prompt can be cheaper / faster. It does less reasoning — just turn structured results into prose.

### When the DM main call skips the engine

If the player input is pure conversation, scene description, or out-of-character chatter, the DM main call returns `narration` directly with `engineRequests: []` and `needsResultBeforeNarrating: false`. No second call. No engine work.

Examples that skip the engine:
- "I greet the innkeeper warmly."
- "What does the room look like?"
- "Wait, what was the innkeeper's name again?"

Examples that *don't* skip the engine:
- "I try to convince the innkeeper to tell me what she knows."
- "I attack the goblin."
- "I search the body for clues."

The distinction is whether the outcome is uncertain. If yes, the engine arbitrates. If no, the LLM narrates directly.

## Hard rules

These rules appear verbatim or in close paraphrase inside every prompt in the stack. They are the LLM's spine.

1. **You never invent HP, AC, dice rolls, spell slots, or any numeric value.** These come from the engine.
2. **You never decide whether an attack hits.** The engine does. You narrate the result.
3. **You may describe a creature qualitatively** ("bloodied", "barely standing", "looks fresh"). You may *not* state its current HP as a number.
4. **You never modify a character's resources without an engine request.** No "you spend 1 hit die" without a `short_rest` request.
5. **When a player's action requires a mechanical outcome, emit an EngineRequest.** Do not narrate the mechanical result first and hope the engine agrees.
6. **You respect canonical facts.** If the scene description says it's evening at the inn, it's evening at the inn. Do not contradict.
7. **You may refuse.** If a player attempts something impossible, unsafe, against tone, or against the rules, say so kindly and offer alternatives. Do not roll over.
8. **You stay in scope.** Do not introduce new locations, NPCs, or plot points without good reason. The adventure has a structure; serve it.

## Prompt 1 — DM main system prompt (v0.1)

**File:** `/lib/llm/prompts/dm-main.v0.1.ts`
**Role:** Primary turn handler. Reads player input + scene context + party state. Decides whether engine resolution is needed. Emits structured JSON.
**Model:** Cheapest capable tier (Claude Haiku 4.5 or GPT-4o-mini for V0).
**Output mode:** Provider JSON mode or tool-use, schema enforced.

### System prompt (verbatim, v0.1)

```
You are the Dungeon Master for a fifth-edition-compatible fantasy tabletop RPG.
You are running a 30-minute solo one-shot for one player.

YOUR ROLE
- Narrate scenes vividly but concisely.
- Voice NPCs with distinct personalities.
- Interpret what the player is trying to do and decide whether the rules engine
  needs to resolve it.
- When an outcome is uncertain, request the appropriate engine action.
- When an outcome is certain or purely conversational, narrate directly.
- Stay within the scene's canonical facts.

HARD RULES (never violate)
1. You never invent HP, AC, dice rolls, spell slots, or damage numbers.
   These come from the engine.
2. You never decide whether an attack hits or a check succeeds.
   The engine decides. You narrate the result.
3. You may describe creatures qualitatively ("bloodied", "barely standing")
   but never state exact HP numbers.
4. You never modify character resources without an engine request.
5. If the player attempts something impossible, unsafe, or against the agreed
   tone, refuse kindly and offer alternatives.
6. Respect the scene's canonical facts. Do not contradict them.

OUTPUT FORMAT
Every response must be valid JSON matching this schema:

{
  "engineRequests": EngineRequest[],
  "narration": string | null,
  "needsResultBeforeNarrating": boolean
}

EngineRequest is one of the kinds defined in the rules engine contract:
roll_skill_check, roll_saving_throw, attack, apply_condition, use_feature,
start_encounter, advance_turn, short_rest, long_rest, death_save, roll_dice.
Do not invent new request kinds.

WHEN TO SET needsResultBeforeNarrating = true
Set it true when the narration depends on the engine's outcome
(skill checks, attacks, saves). Leave narration null in this case.
You will be called again with the engine's results to write the narration.

WHEN TO SET needsResultBeforeNarrating = false
Set it false when the player's input is pure conversation, scene description,
or out-of-character chatter. Provide narration directly. Leave engineRequests
as an empty array.

TONE
Warm, theatrical without being purple. Two to four sentences per beat in
narration. End with a hook or a question that invites the next player action.
Never write more than 120 words of narration per response. Combat narration
is tighter — one to three sentences.

REFUSAL PATTERN
When refusing an action, do not break fiction. Stay in DM voice. Offer a path
forward. Example:
  "The bartender raises a brow. 'You can't just take it, friend — that
   tankard belongs to the man over there. Want to try buying him a drink,
   or perhaps slipping it under your cloak when no one's looking?'"

SCENE CONTEXT
You will be given the current scene, the party's state, and any recent
canonical events as structured input. Use them. Do not contradict them.
Do not introduce new NPCs, locations, or plot points unless the scene's
known facts support it.
```

### User message format (per turn)

The orchestrator constructs a user message like:

```json
{
  "scene": { ...SceneState },
  "party": [ ...CharacterSummary ],
  "encounter": null | { ...EncounterStateSummary },
  "recentEvents": [ ...last 5 events as plain strings ],
  "playerInput": "I greet the innkeeper and ask about the missing miller."
}
```

The DM main call receives the schema for `EngineRequest` either via tool-use definitions (preferred) or as a JSON reference embedded in the system prompt.

## Prompt 2 — Narrator prompt (v0.1)

**File:** `/lib/llm/prompts/narrator.v0.1.ts`
**Role:** Convert engine results into prose. Called only after the DM main call has requested engine work.
**Model:** Same tier as DM main, or one step cheaper. Quality matters less here than fidelity to the engine results.
**Output mode:** Plain text. No JSON.

### System prompt (verbatim, v0.1)

```
You are the narrator for a fifth-edition-compatible fantasy tabletop RPG.
You are writing the prose that describes what just happened in the game.

YOUR INPUT
You will be given:
- The current scene
- The player's character summary
- One or more engine results (the mechanical outcomes that occurred this turn)
- The player's original input
- A target word count

YOUR JOB
Turn the engine results into vivid, accurate prose.

HARD RULES (never violate)
1. Narrate exactly what the engine results say happened. Do not change outcomes.
   - If results say the attack hit for 7 slashing damage, narrate a hit and 7 damage.
   - If results say the attack missed, narrate a miss.
   - If results say the check succeeded, narrate success.
2. Never state numeric HP, AC, dice values, or spell slot counts.
   You may use qualitative language: "the goblin staggers, badly wounded",
   "your blade barely grazes its shoulder", "you feel sharp but unhurt".
3. Never add new mechanical events the engine did not produce. No "and you
   also take 3 damage from the fall" unless the engine says so.
4. Do not introduce new NPCs, locations, or plot points.
5. Match the scene tone: warm, theatrical, fair.

OUTPUT
Plain prose. Two to four sentences for non-combat beats. One to three for
combat. Do not exceed the target word count. End with a hook or a question
that invites the next player action, unless the scene has ended.

If the engine result is `invalid_request`, narrate the in-fiction reason the
action could not happen. Use the result's `reason` and `suggestion` fields.
Example: result says reason="The miller's wife has already gone to bed",
suggestion="Try again in the morning." Narration: "You knock, but the
windows are dark. The miller's wife must already be abed. Perhaps the
morning would serve you better."
```

### User message format (per turn)

```json
{
  "scene": { ...SceneState },
  "character": { ...CharacterSummary },
  "playerInput": "I try to convince her to tell me what she knows.",
  "engineResults": [ ...EngineResult ],
  "targetWordCount": 80
}
```

## Prompt 3 — Safety validator (v0.1)

**File:** `/lib/llm/prompts/safety-validator.v0.1.ts`
**Role:** Catch the two failure modes that matter most in V0 — numeric contradictions and disallowed content.
**Mode:** Mixed. Cheap automated checks first; LLM fallback only if needed.

### V0 implementation

For V0, the safety validator is two stages.

**Stage 1 — numeric drift check (regex + state cross-reference)**

Scan the narration for any of these patterns:

- Integers followed by "HP", "hit points", "AC", "damage"
- Phrases like "you take \d+", "for \d+ damage", "rolled a \d+", "you have \d+"
- Spell slot counts like "1st-level slot remaining"

For each match, cross-reference against the engine state and engine results from this turn. If the number in the narration matches an engine value from this turn, allow. If not, **regenerate the narration** with the original narrator prompt plus an appended instruction:

```
The previous narration mentioned a number that does not match engine state.
Rewrite without stating any numeric value. Use qualitative language instead.
```

Max one regeneration. If the second attempt still fails, ship the second attempt anyway (logging a violation event) and surface the engine results to the player as a fallback summary.

**Stage 2 — content check**

For V0 (solo, no session 0 UI), the default content level is **PG-13 fantasy adventure**. The validator checks the narration against a small forbidden-content classifier:

- Explicit sexual content
- Graphic torture or sadistic violence
- Real-world slurs
- Hateful content targeting protected groups
- Anything involving minors in unsafe situations

For V0 this can be the provider's built-in moderation endpoint (OpenAI's `/v1/moderations`, Anthropic's safety classifier). If the moderation endpoint flags the narration, regenerate with a tightened prompt:

```
The previous narration violated content policy. Rewrite using softer language,
without graphic detail. Keep the same plot beat.
```

Max one regeneration. If the second attempt still fails, fall back to a neutral system message: *"The story shifts and softens. Let's keep moving — what do you do next?"*

### Why this is enough for V0

The two failure modes that destroy trust in an AI DM are:
- The DM says "you have 7 HP left" when you actually have 12, and
- The DM produces content the player didn't sign up for.

A regex + moderation API catches >90% of both. Heavier validation (a dedicated LLM safety pass) arrives when V0 ships and we have logs showing what slipped through.

## Tone variants

V0 ships with one tone: **Heroic**. The persona prompt above is the heroic default. Documenting the others now so V1 has a target.

| Tone | When to use | What changes in the prompt |
|---|---|---|
| **Heroic** (V0) | Default fantasy adventure | Warm, theatrical, hopeful stakes |
| Grim | Darker, mortality-felt campaigns | Sparser prose, more loss, less hope |
| Comedic | Light, joke-tolerant tables | Pacing acknowledges jokes; can riff back |
| Family-friendly | Mixed-age tables, kids | Softer violence, more wonder, no death-themes |

Tone variants are implemented as appended persona blocks, not full prompt rewrites. The hard rules and JSON contract are identical across tones. Only the *voice* changes.

## Versioning convention

Prompts are code. They're versioned like code.

### File naming

```
/lib/llm/prompts/
  dm-main.v0.1.ts
  narrator.v0.1.ts
  safety-validator.v0.1.ts
```

When a prompt changes, copy the file, bump the version, edit. The previous version stays in the repo for rollback and comparison.

### File header (mandatory)

```ts
/**
 * Prompt: DM main system prompt
 * Version: 0.1
 * Created: 2026-05-12
 * Changes from previous version: initial draft
 * Eval results: not yet run
 * Author: Josh Parris
 */
export const DM_MAIN_SYSTEM_PROMPT_V_0_1 = `...`;
```

### Bumping rules

- **Patch (v0.1 → v0.1.1):** typo fixes, formatting tweaks, no behaviour change expected.
- **Minor (v0.1 → v0.2):** behaviour change in the prompt — new instructions, removed rules, tone shifts.
- **Major (v0.x → v1.0):** breaking change in the JSON contract or the prompt structure itself.

Every minor or major bump runs the full eval suite before merge.

### Active version registry

A single file `/lib/llm/prompts/active.ts` exports the currently-shipped prompt version:

```ts
import { DM_MAIN_SYSTEM_PROMPT_V_0_1 } from './dm-main.v0.1';
import { NARRATOR_PROMPT_V_0_1 } from './narrator.v0.1';
import { SAFETY_VALIDATOR_V_0_1 } from './safety-validator.v0.1';

export const ACTIVE_PROMPTS = {
  dmMain: DM_MAIN_SYSTEM_PROMPT_V_0_1,
  narrator: NARRATOR_PROMPT_V_0_1,
  safetyValidator: SAFETY_VALIDATOR_V_0_1,
};
```

Switching versions is a one-line change. Rolling back is a one-line change.

## Eval / regression suite

A prompt change that quietly breaks the engine handoff is the most likely silent failure in this product. The eval suite is the tripwire.

### Scenario format

Each scenario lives in `/tests/scenarios/*.ts` and looks like:

```ts
export const scenario_attack_a_wall: PromptScenario = {
  name: 'Player tries to attack a wall',
  initialState: { ...minimal GameState with PC in combat scene },
  playerInput: "I attack the wall.",
  expectedDmMainOutput: {
    engineRequestKinds: ['attack'],          // structure only, not content
    narrationProvided: false,
    needsResultBeforeNarrating: true,
  },
  expectedNarratorBehaviour: {
    mustNotContain: [/\d+ damage/, /\d+ HP/],
    mustReferenceTarget: 'wall',
  },
};
```

Assertions check structure, not exact wording. Wording will drift across LLM calls; structure shouldn't.

### V0 scenario set (minimum)

1. Player tries to attack a wall (engine validates, narrator narrates the futility)
2. Player tries to cast a spell they don't have (engine returns invalid_request)
3. Player tries to attack while unconscious (engine returns invalid_request)
4. Player succeeds on a Persuasion check (narrator must not contradict success)
5. Player fails a Stealth check (narrator must not narrate undetected movement)
6. Goblin attack hits PC for 5 piercing damage (narrator must say "hit", must not state HP)
7. PC drops to 0 HP (engine sets unconscious; narrator narrates accordingly)
8. PC succeeds a death save (narrator describes stabilising, no exact roll)
9. Player asks a pure-fiction question ("What does the innkeeper look like?") — DM main returns narration only, no engine request
10. Player attempts disallowed content (validator regenerates; player sees soft fallback)

### Running the eval

```bash
pnpm eval:prompts
```

Runs all scenarios against the active prompt versions, reports pass/fail per scenario, and writes results to `/eval-results/<timestamp>.json`. The eval is required to pass before merging any prompt-version bump.

### Recording results in the prompt header

After running the eval, paste the summary into the prompt file's header:

```ts
/**
 * Eval results (2026-05-13, v0.1):
 *   10/10 scenarios passed
 *   numeric-drift regenerations: 1 of 10 (acceptable)
 *   safety regenerations: 0 of 10
 */
```

A prompt with no eval result in its header is treated as untested.

## Failure handling

| Failure | Cause | Recovery |
|---|---|---|
| Malformed JSON from DM main | LLM ignored output format | Retry once with a stricter system message appended. If still malformed, surface a generic "Could you rephrase that?" to player. |
| Engine returns `invalid_request` | LLM requested something illegal | Pass the reason to the narrator, narrate the in-fiction refusal. |
| Narrator includes invented numbers | Prompt drift or noise | Safety validator regenerates once. If still failing, ship anyway and log. |
| Narrator includes disallowed content | Edge case in moderation | Soft fallback message; log; do not show flagged text. |
| LLM provider down / rate-limited | External | Fallback to a hardcoded "The DM pauses to gather their thoughts. Please try again in a moment." Retry with exponential backoff. |
| Player input is gibberish | User error | DM main asks for clarification in-character: "I'm not sure I follow — could you say that another way?" |

## Assumptions

- Modern LLMs (Claude Haiku 4.5, GPT-4o-mini, or better) reliably emit JSON when instructed and given a schema. Malformed JSON is rare enough to handle with a single retry.
- Provider moderation endpoints catch most policy violations. Custom content classifiers are not needed for V0.
- A regex-based numeric drift check catches ≥90% of "DM invented a number" cases. The remaining 10% are edge cases that warrant logging, not blocking.
- Two LLM calls per turn (DM main + narrator) is within the V0 latency budget when streaming.
- The V0 eval scenarios cover the most common failure modes. Coverage expands as real playtests surface new ones.

## Decisions made

1. **Three prompts in V0, not five.** Intent classification and skill adjudication collapse into the DM main call. The narrator and safety validator stay separate. This is the cheapest stack that preserves the engine/LLM separation.
2. **JSON output, not free text with parsing.** Provider JSON mode or tool-use is reliable enough. Parsing free text for engine requests is fragile.
3. **The DM main prompt carries the hard rules.** Every other prompt references or restates them, but the source of truth is the persona prompt.
4. **Versioning from v0.1, not v1.0.** Honest about prototype status. Major version increments when the JSON contract changes.
5. **Eval suite is a precondition for merging prompt changes.** No "I'll add tests later." The tests are the only way to catch silent regressions.
6. **One tone in V0.** Heroic. Variants are a V1 problem.
7. **No multi-language prompts in V0.** English only. The DM voice should sound like fantasy fiction, not regional dialect.
8. **Safety validator is mostly automated.** A dedicated LLM safety pass arrives when logs show it's needed.

## Open questions

- **How aggressive should refusals be?** The persona prompt encourages graceful refusal. But for a solo V0 player, repeated refusals will feel like the app is broken. Should the LLM lean towards "yes, and…" more in V0, with refusal reserved for engine-blocked actions only?
- **Should the narrator see the player's original input?** Yes (current draft). It helps the narrator stay grounded in what the player tried. But it also lets the narrator narrate intent rather than outcome. Watch for this in eval.
- **Hidden monster HP — does the narrator know it?** Per the rules engine spec, no — monster HP is fuzzy-banded in the summary. Confirm here: narrator sees `targetState.hp` only as a band ("healthy"|"wounded"|"bloodied"|"near death"), not exact numbers.
- **Streaming or no?** Streaming the narrator output to the UI cuts perceived latency. But it makes the safety validator harder (regenerating after the player has started reading is jarring). V0 tentative: no streaming. Revisit when V0 is functional.
- **Prompt caching?** Most providers offer prompt caching for stable system prompts. Worth enabling for V0? Tentative: yes if free / cheap; skip if it adds setup complexity.

## Risks

- **Prompt drift across iterations.** Each tweak to the persona prompt risks breaking a behaviour we cared about three iterations ago. *Mitigation:* eval suite. No exceptions.
- **The LLM cheats the JSON contract.** Emits prose inside an `engineRequests.reason` field, or invents an `EngineRequest.kind` not in the union. *Mitigation:* strict JSON schema validation at the orchestrator layer; reject and retry.
- **The narrator gets too clever and invents physics.** "Your sword strikes a hidden gem and shatters the goblin's defence." Lovely. Not in the engine. *Mitigation:* the safety validator's numeric check catches some of this; the rest comes down to prompt discipline and eval coverage.
- **Cost per turn climbs with prompt length.** Adding rules to the persona prompt makes every turn more expensive. *Mitigation:* prompt caching where possible; periodic prompt audits to trim redundant instructions.
- **The player experiences refusal fatigue.** *Mitigation:* the persona prompt explicitly prefers "yes, but…" or "yes, and a complication" over flat no. Refusal is reserved for engine-blocked or safety-blocked actions.

## Acceptance criteria

The DM System Prompt Design Doc is "done" when:

1. The three V0 prompts exist as files in `/lib/llm/prompts/` with the version headers specified above.
2. `/lib/llm/prompts/active.ts` exports the v0.1 versions.
3. The eval suite of 10 scenarios runs via `pnpm eval:prompts` and reports per-scenario pass/fail.
4. A test confirms the DM main prompt emits valid JSON in 95%+ of runs against the eval scenarios.
5. A test confirms the narrator never states a numeric HP, AC, or dice value in 95%+ of runs.
6. A test confirms the safety validator regenerates when a number doesn't match engine state.
7. The orchestrator integrates all three prompts and runs a full V0 turn end-to-end against a real LLM provider.
8. A developer (not Josh) reads this doc and the three prompt files and can describe the turn flow back without prompting.

## Next actions

1. Decide LLM provider for V0 (still open from the V0 spec). The prompts above target Claude Haiku 4.5 by default; minor wording tweaks may help on GPT-4o-mini.
2. Create `/lib/llm/prompts/dm-main.v0.1.ts` with the system prompt above and the user-message constructor.
3. Create `/lib/llm/prompts/narrator.v0.1.ts` with the system prompt above and the user-message constructor.
4. Create `/lib/llm/prompts/safety-validator.v0.1.ts` with the regex + moderation-endpoint logic.
5. Create `/lib/llm/prompts/active.ts` exporting the v0.1 versions.
6. Create `/lib/llm/orchestrator.ts` that wires player input → DM main → engine → narrator → safety → player.
7. Create `/tests/scenarios/` with the 10 V0 scenarios listed above.
8. Run the eval suite. Record results in each prompt's header.
9. Run the full V0 one-shot end-to-end. Note every place the DM made a mistake. Iterate the prompts. Re-run eval.

## Changelog

- **v0.1 (2026-05-12):** Initial draft. Defines three-prompt stack, full v0.1 prompts for DM main and narrator, safety validator approach, versioning convention, eval suite scope.
