# Deployment Checklist

## Before Opening A PR

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm eval:prompts
pnpm build
```

- [ ] Confirm no `.env*`, `.data/`, private modules, PDFs, or API keys are tracked
- [ ] Confirm `vercel.json` still uses `pnpm build`
- [ ] Confirm the branch is pushed without force
- [ ] Open a PR; do not merge until CI and preview checks pass

## Environment

- `PARTYQUEST_LLM_PROVIDER`: provider order, defaults to Groq
- `GROQ_API_KEY`, `OPENAI_API_KEY`, or `OPENROUTER_API_KEY`: configure only in the deployment dashboard
- `PARTYQUEST_FORCE_MOCK=true`: optional Table Rules-only deployment
- `PARTYQUEST_MAX_TURNS_PER_SESSION`: optional positive integer cost guardrail
- Never commit `.env*`

## Preview Verification

- [ ] Open `/api/health`; confirm no secrets are exposed
- [ ] Open `/`, `/start`, and `/play`
- [ ] Start a session and send a turn
- [ ] Confirm Table Rules is shown when no LLM is used
- [ ] Try an impossible action and confirm state does not mutate
- [ ] Check phone-width layout and keyboard navigation

## Persistence Warning

Production sessions are not durable on Vercel. The current server store uses process memory on Vercel, so sessions may disappear across instances or deployments. Do not claim durable cloud saves until a durable adapter is implemented.

## Production

- [ ] Review CI and preview deployment
- [ ] Review environment variables in Vercel
- [ ] Confirm persistence limitations are acceptable
- [ ] Production promotion requires explicit human approval
