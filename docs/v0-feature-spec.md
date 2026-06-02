---
doc: V0 Feature Spec
project: PartyQuest / DM-in-a-Box
status: historical draft v0.1
owner: Josh Parris
date: 2026-05-12
audience: developers, coding agents, future Josh
---

# V0 Feature Spec — DM-in-a-Box

> **Accuracy note (2026-06-02):** This is the original V0 scope document, not a current implementation inventory. The current app has expanded beyond this spec: Next.js 16, Groq by default with optional comma-separated provider/key failover, multiple character templates, optional multi-character party setup on one device, backgrounds, DM personas, private module loading/import, local `.data` persistence, client snapshots, physical dice entry, tutorial scenario, recap export, and partial encounter balancing/canon summarization. Use `docs/todo.md` for the current "what remains" list.

## Purpose

Define the smallest possible build that proves the core architectural bet:
**a deterministic rules engine + an LLM narrator can run a satisfying short fantasy RPG scene.**

If V0 is fun, the larger product is worth building. If it isn't, no amount of voice, multiplayer, or polish saves it.

## Success thesis

> A single person can sit down at a browser, click **Start**, and play a coherent 30-minute solo fantasy one-shot — one social scene, one exploration scene, one combat — with a pre-generated level-3 Fighter, and finish thinking *"that was actually fun."*

## In scope

- **Platform:** Browser only. Desktop or mobile web. Original target was Next.js 14 PWA; the current app uses Next.js 16.
- **Players:** Solo, single device. No accounts. No multiplayer.
- **Input/output:** Text only. No voice (no STT, no TTS).
- **Character:** One hand-built pre-generated level-3 Fighter. No character creation.
- **Adventure:** One hardcoded 30-minute one-shot with three scenes:
  1. Social — arrival at a remote inn, talk to the innkeeper, learn the hook.
  2. Exploration — investigate a missing-person trail with skill checks.
  3. Combat — single goblin ambush, 2–3 enemies, ends in resolution.
- **Rules engine (deterministic TypeScript):**
  - d20 with advantage/disadvantage, damage rolls
  - HP, AC, attack rolls, saving throws
  - Skill checks against a DC
  - Initiative + turn order + basic action economy (action, move)
  - Conditions: prone, unconscious (others later)
  - Spell slot tracking (Fighter has none, but slot infrastructure exists)
  - Death saves
- **LLM narrator:**
  - Intent classifier (action / dialogue / exploration / OOC)
  - Skill check adjudicator (LLM picks skill + DC, engine rolls)
  - Narrator (turns engine results into prose)
  - One DM persona prompt, versioned (v0.1)
- **UI:**
  - Narration panel (scrolling text)
  - Input box
  - Side panel: HP, AC, basic inventory, spell slots if any
  - Visible dice roller with results + breakdown
  - Combat HUD when initiative is active (turn order, current turn)
- **Session state:** Original target was in-memory only. Current implementation persists session JSON under `.data/` locally, uses process memory on Vercel, and stores a client snapshot in `localStorage`.
- **Content:** SRD 5.2.1-compatible. Original setting flavour only. No D&D trademarks anywhere.
- **Quality:**
  - Regression test suite for engine functions (dice, attack, damage, skill check)
  - At least 5 scripted scenario tests (e.g. "player out of HP tries to attack")
  - Prompt files versioned with changelog headers

## Out of scope

These are explicitly excluded from V0. Do not build them yet.

- Multiplayer, room codes, lobby, WebSockets
- Voice input or output
- User accounts, auth, billing
- Persistence beyond the active browser session
- Character creation or character import
- Any class besides Fighter; any level besides 3
- Full SRD spell list (V0 needs ~20 spells max, none cast by the pregen)
- Full monster catalogue (V0 needs ~10 monsters)
- Image generation, portraits, maps, grids
- Adventure generator — the one-shot is hand-authored
- Campaign continuity, recap, "previously on" memory
- Native iOS / Android wrappers
- Session 0 wizard, X-card UI (V0 is solo; safety is enforced via the prompt + content classifier only)
- Host controls (no multiplayer to host)
- Analytics dashboards
- Cost caps, usage metering
- Homebrew, custom rules, levelling

## Architecture (one-line version)

`player input → intent classifier → engine validates legality → engine rolls if needed → LLM narrates engine result → response to player`

The engine never writes prose. The LLM never invents numbers.

## Decisions made

- **Hybrid engine + LLM** is the non-negotiable architecture. Engine in `/lib/engine` (pure TypeScript, no AI calls). LLM in `/lib/llm`.
- **Text-first** because voice latency and cost would obscure whether the core loop is fun.
- **Solo** because multiplayer sync is a distraction from the architectural question.
- **Hardcoded adventure** because adventure generation is its own hard problem; not the bet being tested.
- **Pre-generated Fighter** because character creation is months of work that doesn't answer the V0 question.
- **In-memory state** because persistence adds complexity without testing the bet.
- **One LLM provider at a time** was the original decision. Current implementation defaults to Groq and can try a comma-separated provider list such as `groq,openai`; Anthropic is not wired.

## Assumptions

- Cheap LLM tier (e.g. Claude Haiku, GPT-4o-mini) is good enough for V0 quality.
- A regression test suite of 5–10 scripted scenarios catches most prompt regressions.
- SRD 5.2.1 content (Open5e / 5e-bits) is sufficient for V0 mechanics and one fighter pregen.
- Total V0 build effort: 2–6 weeks of part-time work, assuming Codex/Cursor assistance.
- V0 API spend during development: under AUD $200.

## "Done" criteria

V0 is done when **all** of the following are true:

1. A fresh user lands on the home page, clicks **Start**, and is in scene 1 within 5 seconds.
2. The player can complete all three scenes in sequence and reach an ending screen.
3. HP, action economy, and dice are correct in every regression test. Engine is the source of truth.
4. The LLM never states an HP value, dice roll, or spell slot count that contradicts engine state. Verified by a regression test that injects engine state and inspects narrator output.
5. The combat scene runs to completion: initiative rolled, turns alternate, damage applied, encounter ends when one side reaches 0 HP.
6. The pregen Fighter's character sheet stays in sync with engine state at all times.
7. README documents the hybrid architecture, how to run locally, how to run the regression tests, and how to deploy to Vercel.
8. Five people who are not Josh have played it end-to-end. At least three describe it as "actually fun" or "I'd play that again."

## Open questions

- Which LLM provider for V0? (Claude Haiku 4.5 vs GPT-4o-mini — decide before scaffolding.)
- How does the LLM signal "I want a skill check"? Structured JSON tool call, or tagged response parsed by the orchestrator?
- Do we accept theatre-of-the-mind for combat positioning in V0, or do we need simple position tags ("engaged / near / far")? Tentative: theatre-of-the-mind, no positioning.
- Does the V0 pregen Fighter need a backstory hook embedded in the adventure, or is the character generic?
- Where does the hardcoded adventure live — JSON file, TypeScript module, or markdown?

## Risks

- **Prompt drift:** Iterating on the DM prompt breaks earlier behaviour. *Mitigation:* versioned prompts + regression tests from day 1.
- **Engine/LLM contract leakage:** LLM starts inventing numbers despite system prompt rules. *Mitigation:* post-generation validator that scans LLM output for numeric claims and flags discrepancies with engine state.
- **Cold-start UX:** Solo player has no idea what to do in scene 1. *Mitigation:* the opening narration ends with a concrete suggestion ("Try saying: *I greet the innkeeper* or *I order a drink*").
- **Fun question unanswered:** The 30-minute scene is technically complete but boring. *Mitigation:* hand-author the adventure with real stakes, a twist, and a satisfying ending — don't let the LLM improvise the structure.
- **Scope creep:** "While we're in there…" *Mitigation:* this document. Anything not listed in *In scope* is out. Re-open this doc to add anything.

## Next actions

1. Decide LLM provider for V0 (today).
2. Write the **Rules Engine Technical Spec** (next doc).
3. Write the **DM System Prompt Design Doc** (third doc).
4. Run the Codex scaffold prompt from `ai-dm-app-gaps-and-next-steps.md` Part 4.
5. Stub the LLM responses with hardcoded text first; get the engine + UI loop working end-to-end before spending a cent on tokens.
6. Wire in the real LLM. Play through the one-shot 10 times. Find every broken seam.
7. Invite five non-Josh humans to play. Watch them. Don't help.

## Changelog

- **v0.1 (2026-05-12):** Initial draft. Synthesised from project brief + gaps document.
