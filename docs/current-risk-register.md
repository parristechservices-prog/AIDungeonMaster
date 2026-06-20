# Current Risk Register

Updated: 2026-06-06 · annotated 2026-06-20.

> **⚠️ Single source of truth is now [`open-threads.md`](open-threads.md).** This
> register is preserved for history. The **2026-06-20 updates** below record what
> changed this session; the original 2026-06-06 table is left intact.

## 2026-06-20 updates
- **LLM drift:** added a ~390-entry canonical gazetteer + conversation-aware,
  heading-aware source-lore retrieval with an anti-invention guardrail — materially
  reduces NPC/lore drift over long play. Provider standardized on Groq (Anthropic
  provider decided against).
- **Combat:** weapon/monster damage dice, crit-on-kept-die, combat auto-start, and
  death saves on downed characters now correct; `monster_turn` targeting uses the
  seeded provider. Turn ownership / action economy still loose.
- **Persistence:** still High — file-scoped Postgres plan written
  ([persistence-and-spatial-plan.md](persistence-and-spatial-plan.md)); implementation
  in progress.
- **Scene completion:** still uses log-keyword heuristics — unchanged, still High.

| Area | Risk | Severity | Current Mitigation | Next Safe Step |
|---|---|---:|---|---|
| Persistence | Vercel sessions disappear across instances/deploys | High | Client snapshot; honest docs | Select and implement a durable store in a dedicated PR |
| Rules | Scene completion uses log keyword heuristics | High | Validator blocks obvious early advances | Add structured scene flags/success events |
| LLM | Provider output can drift with model changes | Medium | Strict schemas, repair, legality gate, narration gate | Version prompts and run offline fixture evals |
| Cost/abuse | No configurable turn cap or rate limit | Medium | No-key fallback avoids provider calls without keys | Add per-session configurable limit and later IP-aware storage-backed limiting |
| QA | No browser/API smoke test in CI | Medium | 78 Vitest tests and production build | Add no-key API smoke script |
| UX | Failed checks can feel like dead ends | Medium | Mock failure hints | Add calm player-facing recovery panel |
| Combat | Turn ownership/action economy remains loose | Medium | Engine validates actor existence and conditions | Add turn-ownership scaffolding in a focused rules PR |
| Accessibility | Narration/input semantics and mobile focus need review | Medium | Text-first UI | Improve labels, live regions, focus states, reduced motion |
| Security | Local module import endpoints are development-only | Low | Production route guards; private paths ignored | Add explicit docs and regression tests |
| Content | Full published-adventure fidelity is not in the public templates | Low | Original placeholders and private module workflow | Keep licensed text private; improve authoring validation |

## Do Not Touch Yet

- Do not add a paid persistence service without approval.
- Do not merge branches or deploy production from automation.
- Do not add licensed adventure text or private module data.
- Do not attempt a full rules-engine rewrite.
