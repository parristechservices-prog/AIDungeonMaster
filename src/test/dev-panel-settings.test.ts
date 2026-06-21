import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DEV_PANEL_SETTINGS,
  DEV_PANEL_SECTIONS,
  anyDevPanelSectionEnabled,
  mergeDevPanelSettings,
  parseStoredDevPanelSettings,
} from '@/lib/play/dev-panel';

describe('dev panel settings', () => {
  it('defaults every section to off', () => {
    expect(Object.values(DEFAULT_DEV_PANEL_SETTINGS).every((v) => v === false)).toBe(true);
  });

  it('has a section descriptor for every setting key', () => {
    const sectionKeys = DEV_PANEL_SECTIONS.map((s) => s.key).sort();
    const settingKeys = Object.keys(DEFAULT_DEV_PANEL_SETTINGS).sort();
    expect(sectionKeys).toEqual(settingKeys);
  });

  it('merges a stored partial object onto defaults and ignores unknown keys', () => {
    const merged = mergeDevPanelSettings({ showEngineLog: true, bogus: 'x', showMonsterStatBlocks: 'nope' });
    expect(merged.showEngineLog).toBe(true);
    expect(merged.showMonsterStatBlocks).toBe(false); // non-boolean ignored
    expect('bogus' in merged).toBe(false);
  });

  it('parses stored JSON and round-trips a toggle', () => {
    const stored = JSON.stringify({ ...DEFAULT_DEV_PANEL_SETTINGS, showActionEconomy: true });
    expect(parseStoredDevPanelSettings(stored).showActionEconomy).toBe(true);
  });

  it('falls back to defaults for null or malformed JSON (SSR-safe)', () => {
    expect(parseStoredDevPanelSettings(null)).toEqual(DEFAULT_DEV_PANEL_SETTINGS);
    expect(parseStoredDevPanelSettings('{not json')).toEqual(DEFAULT_DEV_PANEL_SETTINGS);
  });

  it('reports whether any section is enabled', () => {
    expect(anyDevPanelSectionEnabled(DEFAULT_DEV_PANEL_SETTINGS)).toBe(false);
    expect(anyDevPanelSectionEnabled({ ...DEFAULT_DEV_PANEL_SETTINGS, showTerrainOverlay: true })).toBe(true);
  });
});
