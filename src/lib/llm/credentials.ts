/**
 * Whether any configured LLM provider can be called this turn.
 */
export function hasLlmCredentials(): boolean {
  if ((process.env.PARTYQUEST_FORCE_MOCK ?? '').toLowerCase() === 'true') {
    return false;
  }

  const provider = (process.env.PARTYQUEST_LLM_PROVIDER ?? 'groq').toLowerCase();

  if (provider === 'openai') {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
  }

  if (Boolean(process.env.GROQ_API_KEY?.trim())) {
    return true;
  }

  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function shouldUseMockFlavorPrefix(): boolean {
  return (process.env.PARTYQUEST_MOCK_FLAVOR ?? '').toLowerCase() === 'true';
}
