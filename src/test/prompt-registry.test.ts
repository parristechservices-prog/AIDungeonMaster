import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '@/lib/game/state';
import { buildSystemPrompt } from '@/lib/llm/system-prompt';
import { ACTIVE_PROMPT_VERSION, PROMPTS, buildVersionedPrompt, resolvePromptVersion } from '@/lib/llm/prompts/registry';

function state() {
  const s = createInitialState('hash');
  s.canonLog = [{ id: 'f', content: 'x', importance: 'high' } as never];
  s.monsters = []; // monster ids are random
  return s;
}

// Character ids carry an incrementing suffix; mask them so output is comparable.
const norm = (t: string) => t.replace(/\(ID: [^)]+\)/g, '(ID: X)');

describe('prompt registry', () => {
  it('active version is registered', () => {
    expect(PROMPTS[ACTIVE_PROMPT_VERSION]).toBeTypeOf('function');
  });

  it('v1 output is byte-identical to the pre-registry inline prompt', () => {
    const hash = createHash('sha256').update(norm(buildVersionedPrompt(state(), 'v1'))).digest('hex');
    expect(hash).toBe('1d9bcf97db487a441a05597611c53f3ab0eff2735a3ce8960c67058172939a6b');
  });

  it('buildSystemPrompt uses the active version', () => {
    expect(norm(buildSystemPrompt(state()))).toBe(norm(buildVersionedPrompt(state(), ACTIVE_PROMPT_VERSION)));
  });

  it('ignores unknown version overrides', () => {
    expect(resolvePromptVersion('nope')).toBe(ACTIVE_PROMPT_VERSION);
    expect(resolvePromptVersion(undefined)).toBe(ACTIVE_PROMPT_VERSION);
    expect(resolvePromptVersion('v1')).toBe('v1');
  });

  it.each(Object.keys(PROMPTS))('%s contains the required sections', (version) => {
    const text = buildVersionedPrompt(state(), version);
    for (const needle of ['## CORE RULES', '## CURRENT STATE', '## THE ADVENTURING PARTY', 'STRICT JSON OUTPUT', '"engineRequests"', '"narration"']) {
      expect(text).toContain(needle);
    }
  });
});
