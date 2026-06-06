# Manual Playtest Checklist

## Setup

- [ ] Run `pnpm install --frozen-lockfile`
- [ ] Run with no provider keys or `PARTYQUEST_FORCE_MOCK=true`
- [ ] Confirm `/`, `/start`, and `/play` load
- [ ] Confirm the mode displays **Table Rules**

## Core Flow

- [ ] Start a fresh Brindlehook Inn session
- [ ] Confirm selected character, scene, goal, and choices
- [ ] Greet Mira and ask about the courier
- [ ] Trigger or simulate a failed social check; confirm recovery guidance
- [ ] Recover and advance to exploration
- [ ] Inspect tracks; confirm a failed check does not create a dead end
- [ ] Enter combat and confirm living/defeated monsters are clear
- [ ] Attack, receive a monster turn, and finish combat
- [ ] Confirm ending/recap flow

## Rules And Safety

- [ ] Try `I stab the moon`
- [ ] Try `I seduce the locked door`
- [ ] Try `I skip to the treasure`
- [ ] Try `I pull out a machine gun`
- [ ] Try an unsupported spell
- [ ] Confirm impossible actions do not mutate state or invent canon
- [ ] Confirm invalid manual rolls `0` and `21` are rejected
- [ ] Confirm an unconscious character cannot attack
- [ ] Confirm a conscious character cannot make a death save
- [ ] Try the appeal flow

## Resilience

- [ ] Refresh `/play` and confirm the client snapshot restores useful UI state
- [ ] Confirm local sessions write only under ignored `.data/`
- [ ] Confirm no-key turns do not call a live LLM provider
- [ ] Confirm repair failure produces a calm clarification

## Accessibility And Layout

- [ ] Complete a turn using keyboard only
- [ ] Confirm input has a visible/accessible label
- [ ] Confirm narration updates are announced sensibly
- [ ] Confirm focus indicators are visible
- [ ] Confirm buttons have comfortable mobile tap targets
- [ ] Check phone-width layout and sticky input behavior
- [ ] Check dark-mode contrast

## Deployment Smoke Check

- [ ] Confirm GitHub CI passes on the PR
- [ ] Confirm Vercel preview builds without API keys
- [ ] Open preview `/play`
- [ ] Confirm production persistence is described as non-durable
- [ ] Do not promote preview to production during QA
