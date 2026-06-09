# Groq Vercel Setup

This project supports `groq` as the live LLM provider while preserving a safe Table Rules fallback.

## Required environment variables

Set in Vercel:

```env
PARTYQUEST_LLM_PROVIDER=groq
GROQ_API_KEY=
GROQ_API_KEYS=,,,
```

- `GROQ_API_KEY` is the primary key.
- `GROQ_API_KEYS` is a comma-separated backup list.
- Duplicate keys are deduplicated automatically.
- `GROQ_API_KEY` and `GROQ_API_KEYS` can both be present.
- Do not include spaces around commas.
- Vercel requires redeploy after changing environment variables.

## Optional environment variables

- `PARTYQUEST_FORCE_MOCK=true` disables LLM mode and forces Table Rules.
- `PARTYQUEST_MOCK_FLAVOR=true` adds mock flavor prefix text when Table Rules fallback is used.

## Health endpoint expectations

The health endpoint exposes safe diagnostics without returning keys:

```json
{
  "ok": true,
  "service": "partyquest",
  "version": "...",
  "forcedMock": false,
  "llmConfigured": true,
  "configuredProviders": ["groq"],
  "providerKeyCounts": { "groq": 5 },
  "storageMode": "memory",
  "promptVersion": "grounded-dm-v0.4"
}
```

## Behavior

- When Groq is configured and returns valid DM turns, the app uses AI mode.
- If Groq fails, returns invalid JSON, or cannot produce a valid turn, the app falls back to Table Rules.
- Generic clarification like “I am not quite sure how to resolve that fairly” is only used if Table Rules itself fails.
- No API key values or prefixes are exposed in the health response.
