import { describe, expect, it } from 'vitest';
import { SKT_CAMPAIGN } from '@/lib/game/campaign/skt';
import { allChaptersReachable, validateCampaign } from '@/lib/game/campaign/validate';
import { isValidAdventureId, resetServerAdventureRegistry } from '@/lib/game/adventures/registry.server';

describe('SKT campaign definition', () => {
  it('is structurally valid (no dangling refs, valid graph)', () => {
    expect(validateCampaign(SKT_CAMPAIGN)).toEqual([]);
  });

  it('covers the full 12-chapter campaign starting at Nightstone', () => {
    expect(SKT_CAMPAIGN.chapters).toHaveLength(12);
    expect(SKT_CAMPAIGN.startChapterId).toBe('skt-ch1-nightstone');
    expect(SKT_CAMPAIGN.chapters[SKT_CAMPAIGN.chapters.length - 1].id).toBe('skt-ch12-doom-of-the-desert');
  });

  it('makes every chapter reachable from the start via transitions', () => {
    expect(allChaptersReachable(SKT_CAMPAIGN)).toBe(true);
  });

  it('gives every chapter level range, locations, and conditions', () => {
    for (const ch of SKT_CAMPAIGN.chapters) {
      expect(ch.levelRange[0]).toBeGreaterThanOrEqual(1);
      expect(ch.levelRange[1]).toBeGreaterThanOrEqual(ch.levelRange[0]);
      expect(ch.majorLocations.length).toBeGreaterThan(0);
      expect(ch.entryConditions.length).toBeGreaterThan(0);
      expect(ch.exitConditions.length).toBeGreaterThan(0);
    }
  });

  it('marks Chapter 1 as authored and links the real module; rest are honest scaffolds', () => {
    const ch1 = SKT_CAMPAIGN.chapters[0];
    expect(ch1.playableStatus).toBe('authored');
    expect(ch1.moduleId).toBe('skt-nightstone-chapter1');
    resetServerAdventureRegistry();
    expect(isValidAdventureId(ch1.moduleId!)).toBe(true);
    for (const ch of SKT_CAMPAIGN.chapters.slice(1)) {
      expect(ch.playableStatus).toBe('scaffold');
    }
  });

  it('models milestone levelling, one per chapter, non-decreasing', () => {
    expect(SKT_CAMPAIGN.milestones).toHaveLength(12);
    let last = 0;
    for (const ch of SKT_CAMPAIGN.chapters) {
      const m = SKT_CAMPAIGN.milestones.find((x) => x.chapterId === ch.id);
      expect(m).toBeDefined();
      expect(m!.grantsLevel).toBeGreaterThanOrEqual(last);
      last = m!.grantsLevel;
    }
  });

  it('keeps late-campaign reveals as dm_secret, not player_known', () => {
    const byId = (id: string) => SKT_CAMPAIGN.knowledgeFacts.find((k) => k.id === id)!;
    expect(byId('k-iymrith-true-role').visibility).toBe('dm_secret');
    expect(byId('k-hekaton-fate').visibility).toBe('dm_secret');
    expect(byId('k-kraken-society').visibility).toBe('dm_secret');
    // Chapter-1 facts are player-observable.
    expect(byId('k-ordning-shattered').visibility).toBe('player_known');
    expect(byId('k-nightstone-attacked').visibility).toBe('player_known');
  });

  it('does not contain long prose (scaffold facts stay short)', () => {
    for (const k of SKT_CAMPAIGN.knowledgeFacts) {
      expect(k.fact.length).toBeLessThan(200);
    }
  });
});
