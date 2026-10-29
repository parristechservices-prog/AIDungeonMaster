# Full Player Simulation QA Report

## Branch

`codex/full-player-simulation-qa`

## Test Method

Repeated production-build API playthroughs in forced Table Rules/no-key mode. Each run starts a fresh session and checks response status, narration, generic fallbacks, hidden social enemies, internal error text, suggested next actions, and required endings. Raw transcripts stay under ignored `.data/playtest-transcripts/`.

## Campaigns And Scenarios Tested

- The Last Lantern at Brindlehook Inn
- Session 0: The Training Grounds
- Crypt of Whispers
- Smuggler's Cove

## Playthrough Runs

- Brindlehook normal, vague, curious, chaotic, adversarial, and believable fresh-player runs
- Normal completion path for every built-in scenario
- Failed-check recovery path for every built-in scenario

## Bugs And Bad Responses Fixed

- Curious side questions and chaotic social actions reached a generic fallback.
- Greeting detection could mistake substrings such as `anything` for `hi`.
- Successful social checks could use narration from the newly advanced exploration scene.
- Sequential adversarial prompts could accidentally advance into combat.
- Goal, mode, appeal, feature, potion, and other meta/state questions lacked direct answers.
- `drink healing potion` was mistaken for ordering a drink.

## UI Confusion Fixed

- Added a first-turn prompt cue for observation, conversation, goal help, and general help.
- Previous stacked fixes already hide future enemies and show failed-check recovery.

## Regression Tests Added

- Dedicated first-minute/basic-player prompt matrix.
- Curious, chaotic, adversarial, state, and meta prompt coverage.
- Social narration timing regression.
- Impossible sequential-action safety cases.

## Smoke Scripts Added Or Updated

- Added `pnpm simulate:player`.
- Expanded `pnpm smoke:api`.
- Added a safe committed simulation summary and ignored raw transcripts.

## Remaining Issues

- Potion healing is not automated in Table Rules mode; the response states this honestly.
- Arbitrary NPC violence and movement remain lightweight rather than full mechanics.
- Scenario-specific local color is strongest in Brindlehook.
- Live LLM-provider behavior still needs explicit credentialed testing.

## Final Verification

- `pnpm lint`: passed
- `pnpm test`: passed, 197/197
- `pnpm eval:prompts`: passed, 7/7
- `pnpm build`: passed
- `pnpm smoke:api`: passed
- `pnpm simulate:player`: passed, 13 playthroughs and 158 prompts
- `git diff --check`: passed

Final recommendation: ready for stacked PR review. Live-provider behavior remains a separate manual check.

## Manual Actions For Josh

- Review the stacked PR and its Vercel preview.
- Test one live-provider session separately when credentials are available.
- Do not commit `.data/playtest-transcripts/`.
