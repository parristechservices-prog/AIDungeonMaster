# Autonomous Upgrade Sprint Report

Started: 2026-06-06

## Branch

`codex/autonomous-project-upgrade-sprint`

Base: `codex/grounded-dm-qa-hardening` at `a0d60c6`

## Baseline

- `pnpm install --frozen-lockfile`: passed
- `pnpm lint`: passed
- `pnpm test`: passed, 78/78
- `pnpm build`: passed
- `.data/`: ignored and not tracked
- Vercel build command: `pnpm build`

## Checkpoint 1: Audit And Backlog

### What Is Already Good

- Mechanics and narration have clear ownership boundaries.
- AI turn schemas are strict and player-owned requests require explicit character IDs.
- State-aware legality checks, repair prompts, result-aware narration, and adversarial tests exist.
- Built-in and template adventures share validated module/scenario types.
- No-key table-rules mode supports a complete deterministic one-shot path.
- CI runs frozen install, lint, tests, and build for pull requests.

### Highest Risks

- Vercel production sessions are process-memory-only and are not durable.
- There is no health endpoint or configurable per-session turn cap.
- Prompt content remains inline and lacks a runnable offline eval command.
- Automated coverage is strong at unit/integration level but lacks an API smoke playtest.
- Play UI needs clearer failed-check recovery, combat actor context, and accessibility semantics.
- Scene-success checks are text/log heuristics instead of structured adventure flags.

### Safe Sprint Targets

1. Add API smoke testing and deepen regression coverage.
2. Improve failed-check, combat, mode, mobile, and accessibility UI.
3. Add health/cost guardrails without external services.
4. Add offline prompt eval infrastructure.
5. Improve scenario validation/docs and run a scripted no-key playtest.

### Deferred

- Durable cloud storage requires a provider/account decision.
- Full SRD spell/action-economy implementation is too broad for this sprint.
- Production deployment, merges, paid services, and live-provider tests require external permission or credentials.

## Commits Pushed

- `b62e754` - docs: add sprint audit and playtest checklists
- `3b2cfec` - test: add no-key API smoke coverage
- `3430d42` - feat: improve failed-check and combat play UX
- `1737d8d` - feat: add health guardrails and prompt evals
- `dc27d1c` - test: validate scenario grounding and offline flows
- `9ac4543` - docs: finalize sprint QA and deployment guidance

## Checkpoint 2: Tests And QA Depth

- Added route-level no-key API integration coverage for session start, Table Rules turns, silly input, and invalid manual rolls.
- Added `pnpm smoke:api`, a lightweight local/preview API smoke script that does not call live LLM APIs when the target is configured for no-key mode.
- Chose this over Playwright for the checkpoint to avoid browser-binary and CI churn.

## Checkpoint 3: Player Experience And Accessibility

- Added calm failed-check recovery guidance with a suggested next action.
- Made the Table Rules / AI Director indicator and active character clearer.
- Improved combat participant labeling for multi-character parties and marked defeated monsters distinctly.
- Made narration a labelled live log and added a labelled, keyboard-focused, mobile-sticky action input.
- Limited internal narration warning cues to development builds.
- Added reduced-motion-safe global behavior.

## Checkpoint 4: Operational Readiness And Prompt Evals

- Added a secret-safe `/api/health` endpoint reporting build, LLM configured state, storage mode, and active prompt version.
- Added optional `PARTYQUEST_MAX_TURNS_PER_SESSION` cost-control scaffolding; defaults remain unlimited.
- Extracted grounded behavior rules into a versioned active prompt module.
- Added offline `pnpm eval:prompts` coverage that requires no live provider keys.

## Checkpoint 5: Scenario Tooling And Offline Completion

- Added module validation for scene boundary references to unknown NPCs and monsters.
- Added deterministic offline completion tests for every built-in scenario.
- Added a scenario authoring checklist focused on grounding, recoverability, and content safety.

## Manual Playtest Results

- Started the built production server locally on port 3100 with `PARTYQUEST_FORCE_MOCK=true`.
- `/api/health` passed and exposed no secrets:
  - `llmConfigured: false`
  - `storageMode: local_files`
  - `promptVersion: grounded-dm-v0.4`
- `pnpm smoke:api` passed:
  - session start succeeded
  - normal turn returned `table_rules`
  - `I stab the moon` emitted no engine requests and returned grounded clarification
- Deterministic automated flows complete all four built-in scenarios offline.
- Live AI-provider testing was not performed because no provider credentials were used.

## Known Remaining Risks

See `docs/current-risk-register.md`.

## Build Status

- `pnpm lint`: passed
- `pnpm test`: passed, 87 tests at the final feature checkpoint
- `pnpm eval:prompts`: passed, 7/7 offline prompt fixtures
- `pnpm build`: passed

## Recommended Next PRs

1. Durable session-storage adapter and provider selection.
2. Structured scene-success flags to replace log keyword heuristics.
3. Turn ownership/action-economy enforcement.
4. Browser E2E and automated accessibility checks.
5. Broader SRD-safe spell and condition coverage.

## Manual Actions For Josh

- Open the sprint PR against `codex/grounded-dm-qa-hardening` while that hardening branch remains unmerged.
- Check GitHub CI and the Vercel preview deployment.
- Review `/api/health`, mobile `/play`, and failed-check recovery in the preview.
- Do not promote to production until persistence limitations and environment variables are reviewed.

CI now runs on pull requests targeting any branch and includes the offline prompt eval, so the stacked sprint PR will receive the same core gates as a PR targeting `main`.
