# DM system prompt changelog

Never edit a released version in place. Add `vN.ts`, register it in `registry.ts`, add an entry below, and run `pnpm test` (the prompt eval in `src/test/prompt-registry.test.ts` checks required sections).

## v1 (active)
- Initial versioned release; text identical to the previous inline prompt in `system-prompt.ts`.
- Sections: personality, campaign guide/tone, core rules, appeals, current state, party, world/NPCs, monsters, memory, response rules (strict JSON output).
- Select another registered version for a trial with `PARTYQUEST_PROMPT_VERSION=<version>`.
