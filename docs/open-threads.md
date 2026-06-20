# Open Threads & Roadmap

Every suggestion, offer, and known gap raised during development that is **not yet
done**, ranked from **highest impact / biggest change** (top) to **lowest impact /
smallest change** (bottom). Completed work is omitted (see git history).

Legend — Impact: 🔴 high · 🟠 medium · ⚪ low. Effort: 🏔️ large · ⛰️ medium · 🪨 small.

| # | Item | Impact | Effort |
|---|------|--------|--------|
| 1 | First-class keep / inn / special-event scenes | 🔴 | 🏔️ |
| 2 | Real party play (AI companion turns) | 🔴 | 🏔️ |
| 3 | Persistent multi-session campaign memory (RAG over canon) | 🔴 | 🏔️ |
| 4 | Voice mode (narration TTS + speech-to-action) | 🟠 | 🏔️ |
| 5 | Procedural quest/encounter director | 🟠 | 🏔️ |
| 6 | Spell/condition duration system (shield, bless, etc.) | 🟠 | ⛰️ |
| 7 | Death saves on damage to unconscious characters | 🔴 | ⛰️ |
| 8 | 429 resilience + "DM is busy" state | 🟠 | ⛰️ |
| 9 | Slim back per-area campaignGuide patches | 🟠 | ⛰️ |
| 10 | Enforce narrated-but-unapplied features (e.g. Second Wind) | 🟠 | ⛰️ |
| 11 | One-command index + gazetteer regeneration | 🟠 | 🪨 |
| 12 | Sub-area retrieval precision (e.g. exact watchtower room) | ⚪ | ⛰️ |
| 13 | Gazetteer extraction polish (paired names, OCR variants) | ⚪ | 🪨 |
| 14 | `monster_turn` target uses `Math.random` not seeded provider | ⚪ | 🪨 |
| 15 | Mock-DM keyword fallback misfires | ⚪ | 🪨 |
| 16 | Preview-environment Vercel vars | ⚪ | 🪨 |
| 17 | Merge the 4 original prod backup keys | ⚪ | 🪨 |
| 18 | Rotate Groq keys shared in chat | ⚪ | 🪨 |
| 19 | Coordinate concurrent agents on `main` | ⚪ | 🪨 |
| 20 | Audit / run the other `C:\dev` apps | ⚪ | — |

---

## Details

### 1. First-class keep / inn / special-event scenes 🔴🏔️
Promote Nightstone's key content to modeled scenes with real NPC entries (Kella
Darkhope, Gum-Gum, the four keep guards, Xolkin Alassandar, Gurrash, Norgra
One-Eye, Rond Arrowhome) and engine objects (the 750gp ring, the bridge jump as a
real check with fall damage, the dead-goblin clue). This makes fidelity survive
even a rate-limit fallback to the mock DM, instead of relying on prompt grounding.
The durable version of the "100% source-correct" goal.

### 2. Real party play (AI companion turns) 🔴🏔️
`GameState.party[]` and `activeCharacterId` already exist, but play is solo. Drive
companion characters as AI actors in initiative, each with their own sheet, spell
slots, and conditions. The mock DM still works because companions resolve through
the deterministic engine.

### 3. Persistent multi-session campaign memory 🔴🏔️
Embed `canonLog` facts and NPC interactions and inject the most relevant into the
prompt per turn (rather than a flat recap), with storage that survives restarts
(Vercel is in-memory per instance today). Distinct from the source-lore RAG, which
grounds the *book*; this grounds the *playthrough*.

### 4. Voice mode 🟠🏔️
Behind the existing `voice` feature flag: narration via TTS and player intents via
STT (Web Speech API or Groq Whisper). Safe because spoken intents still become
structured `engineRequests` validated by the engine.

### 5. Procedural quest/encounter director 🟠🏔️
Use `engine/balancer.ts` to assemble the next encounter/branch scaled to party
HP/resources/level — LLM proposes flavor, engine picks stats/DCs. Makes runs
replayable beyond the hand-authored scenes.

### 6. Spell/condition duration system 🟠⛰️
`shield` and `bless` currently apply permanent conditions (AC+5 / +1d4 forever)
because there's no round/turn duration tracking. Add a duration model so buffs
expire correctly.

### 7. Death saves on damage to unconscious characters 🔴⛰️
In 5e, a hit on a creature at 0 HP causes an auto death-save failure (two on a
crit). The engine doesn't model this. Highest-value pure rule-correctness fix.

### 8. 429 resilience + "DM is busy" state 🟠⛰️
Multi-key failover exists, but when all keys are rate-limited the app silently
drops to the weaker mock DM. Add a short backoff after all keys are exhausted and
surface a "DM is thinking / rate-limited" state instead of confusing fallback text.

### 9. Slim back per-area campaignGuide patches 🟠⛰️
The keep / inn / special-event canon was added to the always-in-prompt
`campaignGuide` as reactive patches. Now that the gazetteer + conversation-aware
retrieval backbone exists, these are belt-and-suspenders. Return the guide to
tone/flow guidance and let the backbone carry facts (do after #1).

### 10. Enforce narrated-but-unapplied features 🟠⛰️
The LLM sometimes narrates using a feature (e.g. Second Wind) without emitting the
`use_feature` engine request, so no mechanical effect occurs. Strengthen the prompt
or add a post-turn reconciliation check.

### 11. One-command index + gazetteer regeneration 🟠🪨
Wrap `scripts/build-source-index.ts` + the Vercel Blob upload (and env URL update)
into a single command so the index and gazetteer regenerate cleanly whenever the
source book changes.

### 12. Sub-area retrieval precision ⚪⛰️
"East watchtower" resolves to the watchtowers section generally, not the exact `2D`
sub-room. Good enough for grounding; tightening would need per-room modeling.

### 13. Gazetteer extraction polish ⚪🪨
A few paired names (Vark, Yek) and OCR variants (Kella ↔ "Keila") aren't perfectly
captured, and some entity notes are weak. Improve the extraction patterns.

### 14. `monster_turn` seeded randomness ⚪🪨
Monster target selection uses `Math.random` instead of the injectable
`randomProvider`, so it isn't deterministic in tests. Small consistency fix.

### 15. Mock-DM keyword fallback misfires ⚪🪨
The table-rules mock occasionally returns a generic "I need more detail" for clear
inputs. Only seen during fallbacks; tune the keyword matching.

### 16. Preview-environment Vercel vars ⚪🪨
`GROQ_API_KEYS` and `SKT_SOURCE_BLOB_URL` are set on Production only — the CLI
loops on a git-branch prompt for Preview. Add them via the Vercel dashboard so
preview deploys have full keys and source lore.

### 17. Merge the 4 original prod backup keys ⚪🪨
The pre-existing production `GROQ_API_KEYS` backups are "Sensitive" and unreadable
via CLI, so they were replaced rather than merged. Re-add them to the pool if their
values are available.

### 18. Rotate Groq keys shared in chat ⚪🪨
Many keys were pasted into chat history; rotate them in the Groq console when
convenient. User action.

### 19. Coordinate concurrent agents on `main` ⚪🪨
A GitHub Copilot agent pushed commits concurrently with this work. Avoid two agents
writing to `main` at once to prevent conflicts. Process note.

### 20. Audit / run the other `C:\dev` apps ⚪
Standing offer from the initial app ranking to dig into, run, or audit the other
projects (Chess trainer, JoshOS, etc.). Out of scope for AIDM.
