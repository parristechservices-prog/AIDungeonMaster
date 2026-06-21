import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAY_DISPLAY_SETTINGS,
  DISPLAY_SECTIONS,
  applyPreset,
  mergePlayDisplaySettings,
  parseStoredPlayDisplaySettings,
  type PlayDisplaySettings,
} from '@/lib/play/display-settings';

describe('play display settings', () => {
  it('defaults to everything visible (no surprise for existing players)', () => {
    const { compactMode, ...rest } = DEFAULT_PLAY_DISPLAY_SETTINGS;
    expect(Object.values(rest).every((v) => v === true)).toBe(true);
    expect(compactMode).toBe(false);
  });

  it('merges a partial stored object onto defaults and ignores junk', () => {
    const merged = mergePlayDisplaySettings({ showAudio: false, bogus: 1, showDicePanel: 'no' });
    expect(merged.showAudio).toBe(false);
    expect(merged.showDicePanel).toBe(true); // non-boolean ignored
    expect('bogus' in merged).toBe(false);
  });

  it('parses stored JSON and round-trips a toggle', () => {
    const stored = JSON.stringify({ ...DEFAULT_PLAY_DISPLAY_SETTINGS, showSuggestedActions: false });
    expect(parseStoredPlayDisplaySettings(stored).showSuggestedActions).toBe(false);
  });

  it('falls back to defaults for null/malformed JSON (SSR-safe)', () => {
    expect(parseStoredPlayDisplaySettings(null)).toEqual(DEFAULT_PLAY_DISPLAY_SETTINGS);
    expect(parseStoredPlayDisplaySettings('{bad')).toEqual(DEFAULT_PLAY_DISPLAY_SETTINGS);
  });

  it('reset (full preset) restores defaults', () => {
    const hidden: PlayDisplaySettings = mergePlayDisplaySettings({ showAudio: false, showDicePanel: false });
    expect(applyPreset('full', hidden)).toMatchObject({ showAudio: true, showDicePanel: true });
  });

  it('minimal preset keeps narration + suggestions, hides aids', () => {
    const m = applyPreset('minimal', DEFAULT_PLAY_DISPLAY_SETTINGS);
    expect(m.showNarration).toBe(true);
    expect(m.showSuggestedActions).toBe(true);
    expect(m.showAudio).toBe(false);
    expect(m.showDicePanel).toBe(false);
    expect(m.showExportButton).toBe(false);
    expect(m.compactMode).toBe(true);
  });

  it('combat preset shows narration/dice/map/character', () => {
    const c = applyPreset('combat', DEFAULT_PLAY_DISPLAY_SETTINGS);
    expect(c.showNarration && c.showDicePanel && c.showMapButton && c.showCharacterButton).toBe(true);
    expect(c.showAudio).toBe(false);
  });

  it('story preset shows narration/suggestions, hides map/dice', () => {
    const s = applyPreset('story', DEFAULT_PLAY_DISPLAY_SETTINGS);
    expect(s.showNarration && s.showSuggestedActions).toBe(true);
    expect(s.showMapButton).toBe(false);
    expect(s.showDicePanel).toBe(false);
  });

  it('does NOT model the Display Settings opener (it can never be hidden)', () => {
    const keys = Object.keys(DEFAULT_PLAY_DISPLAY_SETTINGS);
    expect(keys.some((k) => /display/i.test(k))).toBe(false);
  });

  it('every section item maps to a real setting key', () => {
    const valid = new Set(Object.keys(DEFAULT_PLAY_DISPLAY_SETTINGS));
    for (const section of DISPLAY_SECTIONS) {
      for (const item of section.items) expect(valid.has(item.key)).toBe(true);
    }
  });
});
