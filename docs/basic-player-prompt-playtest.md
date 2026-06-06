# Basic Player Prompt Playtest

Date: 2026-06-06  
Mode: local production build, no-key Table Rules  
Scenario: The Last Lantern at Brindlehook Inn, social scene

## Findings And Fixes

| Prompt group | Expected | Observed before fix | Fixed | Notes |
|---|---|---|---|---|
| Observation | Describe visible inn details | Several prompts fell through to "Mira waits" | Yes | Look, describe, location, people, events, and unusual-detail prompts now return grounded room context. |
| Conversation | Talk or make a valid social check | Plain "talk to Mira" did not start a conversation | Yes | General talk opens conversation; courier/information requests use a valid active-character check. |
| Investigation | Narrate or investigate without generic fallback | Some searches received an unhelpful scene-boundary message | Yes | Room-level investigation points toward Mira and patrons without inventing clues. |
| Movement | Narrate allowed movement or explain boundaries | All movement prompts fell through | Yes | Bar/Mira approach is narrated; leaving explains the consequence and offers useful alternatives. |
| Character/status | Answer from state without a roll | Inventory, HP, AC, and help fell through | Yes | Answers use active-character state and do not advance the scene. |
| Readiness/violence | Narrate readiness; handle unsupported violence cautiously | All prompts fell through | Yes | Ready/draw is narrated; unsupported attacks are blocked in-world without spawning combat. |
| Impossible actions | Reject safely | Already grounded | Yes | Moon, machine gun, treasure skip, impossible flight, and similar prompts remain rejected. |
| Enemy visibility | Hide future encounter monsters | Monsters leaked into the social character sheet | Yes | Non-combat turn responses contain no monsters; Enemies UI is hidden outside active combat. |

## Regression Matrix

Automated coverage in `src/test/basic-player-prompts.test.ts` exercises the full requested first-minute prompt matrix. The API smoke script additionally checks:

- `i look around`
- `what do i see`
- `talk to mira`
- `study the inn patrons`
- `look for clues`
- `what am i carrying`
- `help`
- `i stab the moon`

## Remaining Concerns

- Table Rules mode remains intentionally lightweight and does not model arbitrary NPC violence or freeform movement as full mechanics.
- Scenario-specific observation prose is strongest for the built-in opening scenes; future scenarios should add equivalent grounded guidance.
- Live-provider behavior still depends on provider/model output, though legality and narration gates remain active.
