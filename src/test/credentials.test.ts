import { afterEach, describe, expect, it } from 'vitest';
import { hasLlmCredentials, useMockFlavorPrefix } from '@/lib/llm/credentials';

describe('hasLlmCredentials', () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it('returns false when PARTYQUEST_FORCE_MOCK is true', () => {
    process.env.PARTYQUEST_FORCE_MOCK = 'true';
    process.env.GROQ_API_KEY = 'test-key';
    expect(hasLlmCredentials()).toBe(false);
  });

  it('returns true when Groq key is set (default provider)', () => {
    delete process.env.PARTYQUEST_FORCE_MOCK;
    process.env.PARTYQUEST_LLM_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'test-key';
    expect(hasLlmCredentials()).toBe(true);
  });

  it('returns false when no keys are set', () => {
    delete process.env.PARTYQUEST_FORCE_MOCK;
    process.env.PARTYQUEST_LLM_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = '';
    process.env.OPENAI_API_KEY = '';
    expect(hasLlmCredentials()).toBe(false);
  });
});

describe('useMockFlavorPrefix', () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it('is opt-in via PARTYQUEST_MOCK_FLAVOR=true', () => {
    process.env.PARTYQUEST_MOCK_FLAVOR = 'true';
    expect(useMockFlavorPrefix()).toBe(true);
    process.env.PARTYQUEST_MOCK_FLAVOR = 'false';
    expect(useMockFlavorPrefix()).toBe(false);
  });
});
