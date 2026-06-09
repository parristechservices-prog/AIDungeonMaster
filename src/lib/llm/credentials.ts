/**
 * Whether any configured LLM provider can be called this turn.
 */
export function hasLlmCredentials(): boolean {
  if ((process.env.PARTYQUEST_FORCE_MOCK ?? '').toLowerCase() === 'true') {
    return false;
  }

  const providerList = (process.env.PARTYQUEST_LLM_PROVIDER ?? 'groq')
    .split(',')
    .map((provider) => provider.trim().toLowerCase())
    .filter(Boolean);

  return providerList.some((provider) => getProviderApiKeys(provider).length > 0);
}

export function getConfiguredProviders(): string[] {
  return Array.from(
    new Set(
      (process.env.PARTYQUEST_LLM_PROVIDER ?? 'groq')
        .split(',')
        .map((provider) => provider.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

export function getProviderKeyCounts(): Record<string, number> {
  const providers = getConfiguredProviders();
  return providers.reduce((counts, provider) => {
    counts[provider] = getProviderApiKeys(provider).length;
    return counts;
  }, {} as Record<string, number>);
}

function getProviderApiKeys(provider: string): string[] {
  const keys: string[] = [];

  if (provider === 'openai') {
    keys.push(...(process.env.OPENAI_API_KEYS?.split(',') ?? []).map((k) => k.trim()));
    if (process.env.OPENAI_API_KEY?.trim()) keys.unshift(process.env.OPENAI_API_KEY.trim());
  }

  if (provider === 'groq') {
    keys.push(...(process.env.GROQ_API_KEYS?.split(',') ?? []).map((k) => k.trim()));
    if (process.env.GROQ_API_KEY?.trim()) keys.unshift(process.env.GROQ_API_KEY.trim());
  }

  if (provider === 'openrouter') {
    keys.push(...(process.env.OPENROUTER_API_KEYS?.split(',') ?? []).map((k) => k.trim()));
    if (process.env.OPENROUTER_API_KEY?.trim()) keys.unshift(process.env.OPENROUTER_API_KEY.trim());
  }

  return [...new Set(keys.filter(Boolean))];
}

export function shouldUseMockFlavorPrefix(): boolean {
  return (process.env.PARTYQUEST_MOCK_FLAVOR ?? '').toLowerCase() === 'true';
}

export const useMockFlavorPrefix = shouldUseMockFlavorPrefix;
