import { describe, expect, it } from 'vitest';
import { dmTurnSchema } from '@/lib/llm/contracts';

describe('spatial engine request contracts', () => {
  it.each([
    [{ kind: 'move_area', actorId: 'fighter', targetAreaId: 'temple' }, 'move_area'],
    [{ kind: 'query_current_area', actorId: 'fighter' }, 'query_current_area'],
    [{ kind: 'query_exits', actorId: 'fighter' }, 'query_exits'],
    [{ kind: 'query_actors_present', actorId: 'fighter' }, 'query_actors_present'],
    [{ kind: 'query_path_exists', fromAreaId: 'gatehouse', toAreaId: 'temple' }, 'query_path_exists'],
  ])('parses %s', (request, kind) => {
    const parsed = dmTurnSchema.safeParse(baseTurn(request));
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.engineRequests[0]?.kind).toBe(kind);
  });

  it('repairs type to kind for spatial requests', () => {
    const parsed = dmTurnSchema.safeParse(baseTurn({
      type: 'move_area',
      actorId: 'fighter',
      targetAreaId: 'temple',
    }));
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.engineRequests[0]).toMatchObject({
      kind: 'move_area',
      actorId: 'fighter',
      targetAreaId: 'temple',
    });
  });

  it('strips stray keys from spatial requests', () => {
    const parsed = dmTurnSchema.safeParse(baseTurn({
      kind: 'query_exits',
      actorId: 'fighter',
      invented: 'please keep me',
    }));
    expect(parsed.success).toBe(true);
    const request = parsed.success ? parsed.data.engineRequests[0] : undefined;
    expect(request).toEqual({ kind: 'query_exits', actorId: 'fighter' });
    expect(request && 'invented' in request).toBe(false);
  });
});

function baseTurn(request: Record<string, unknown>) {
  return {
    engineRequests: [request],
    narration: 'You check the route.',
    needsResultBeforeNarrating: true,
  };
}
