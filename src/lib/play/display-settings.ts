'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Player-facing /play display preferences — which optional UI sections are
 * visible. Pure UI state; it never affects game mechanics, engine, or persisted
 * game state. Defaults keep everything currently-visible ON so existing players
 * are not surprised. The Display Settings opener itself is intentionally NOT in
 * this model, so it can never be hidden.
 */
export type PlayDisplaySettings = {
  showSceneMeta: boolean;
  showModePill: boolean;
  showActiveCharacter: boolean;
  showTurnNumber: boolean;
  showNarration: boolean;
  showDicePanel: boolean;
  showSuggestedActions: boolean;
  showAppealDm: boolean;
  showPhysicalDiceToggle: boolean;
  showAudio: boolean;
  showCharacterButton: boolean;
  showMapButton: boolean;
  showDmViewButton: boolean;
  showExportButton: boolean;
  showThemeButton: boolean;
  showBackButton: boolean;
  compactMode: boolean;
};

export const DEFAULT_PLAY_DISPLAY_SETTINGS: PlayDisplaySettings = {
  showSceneMeta: true,
  showModePill: true,
  showActiveCharacter: true,
  showTurnNumber: true,
  showNarration: true,
  showDicePanel: true,
  showSuggestedActions: true,
  showAppealDm: true,
  showPhysicalDiceToggle: true,
  showAudio: true,
  showCharacterButton: true,
  showMapButton: true,
  showDmViewButton: true,
  showExportButton: true,
  showThemeButton: true,
  showBackButton: true,
  compactMode: false,
};

export const PLAY_DISPLAY_STORAGE_KEY = 'aidm.playDisplaySettings.v1';

/** Grouped section metadata for rendering the settings panel. */
export const DISPLAY_SECTIONS: { group: string; items: { key: keyof PlayDisplaySettings; label: string }[] }[] = [
  {
    group: 'Essential',
    items: [
      { key: 'showSceneMeta', label: 'Scene details' },
      { key: 'showModePill', label: 'Mode pill (AI / Table)' },
      { key: 'showActiveCharacter', label: 'Active character' },
      { key: 'showTurnNumber', label: 'Turn number' },
      { key: 'showNarration', label: 'Narration' },
    ],
  },
  {
    group: 'Play aids',
    items: [
      { key: 'showSuggestedActions', label: 'Suggested actions' },
      { key: 'showDicePanel', label: 'Dice panel' },
      { key: 'showPhysicalDiceToggle', label: 'Physical dice toggle' },
      { key: 'showAppealDm', label: 'Appeal the DM' },
      { key: 'showAudio', label: 'Ambient audio' },
    ],
  },
  {
    group: 'Tools',
    items: [
      { key: 'showCharacterButton', label: 'Character button' },
      { key: 'showMapButton', label: 'Map button' },
      { key: 'showDmViewButton', label: 'DM View button' },
      { key: 'showExportButton', label: 'Export recap' },
      { key: 'showThemeButton', label: 'Theme toggle' },
      { key: 'showBackButton', label: 'Back button' },
    ],
  },
];

export type DisplayPreset = 'full' | 'minimal' | 'combat' | 'story';

/** Preset visibility maps. All omit the (always-visible) Display Settings opener. */
export function applyPreset(preset: DisplayPreset, current: PlayDisplaySettings): PlayDisplaySettings {
  const all = (v: boolean): PlayDisplaySettings => ({
    showSceneMeta: v, showModePill: v, showActiveCharacter: v, showTurnNumber: v, showNarration: v,
    showDicePanel: v, showSuggestedActions: v, showAppealDm: v, showPhysicalDiceToggle: v, showAudio: v,
    showCharacterButton: v, showMapButton: v, showDmViewButton: v, showExportButton: v, showThemeButton: v,
    showBackButton: v, compactMode: current.compactMode,
  });
  switch (preset) {
    case 'full':
      return { ...DEFAULT_PLAY_DISPLAY_SETTINGS, compactMode: current.compactMode };
    case 'minimal':
      // Narration + input + suggested actions + (always-on) Display Settings.
      return { ...all(false), showNarration: true, showSuggestedActions: true, compactMode: true };
    case 'combat':
      return { ...all(false), showNarration: true, showDicePanel: true, showMapButton: true, showDmViewButton: true, showCharacterButton: true };
    case 'story':
      return { ...all(false), showNarration: true, showSuggestedActions: true, showActiveCharacter: true, showSceneMeta: true };
    default:
      return current;
  }
}

export function mergePlayDisplaySettings(raw: unknown): PlayDisplaySettings {
  const out: PlayDisplaySettings = { ...DEFAULT_PLAY_DISPLAY_SETTINGS };
  if (!raw || typeof raw !== 'object') return out;
  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_PLAY_DISPLAY_SETTINGS) as (keyof PlayDisplaySettings)[]) {
    if (typeof record[key] === 'boolean') out[key] = record[key] as boolean;
  }
  return out;
}

export function parseStoredPlayDisplaySettings(json: string | null): PlayDisplaySettings {
  if (!json) return { ...DEFAULT_PLAY_DISPLAY_SETTINGS };
  try {
    return mergePlayDisplaySettings(JSON.parse(json));
  } catch {
    return { ...DEFAULT_PLAY_DISPLAY_SETTINGS };
  }
}

/**
 * Hook backing the Display Settings. SSR-safe (reads localStorage in useEffect);
 * writes persist on every change.
 */
export function usePlayDisplaySettings() {
  const [settings, setSettings] = useState<PlayDisplaySettings>(DEFAULT_PLAY_DISPLAY_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setSettings(parseStoredPlayDisplaySettings(window.localStorage.getItem(PLAY_DISPLAY_STORAGE_KEY)));
    } catch {
      // localStorage unavailable — keep defaults.
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: PlayDisplaySettings) => {
    setSettings(next);
    try {
      window.localStorage.setItem(PLAY_DISPLAY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore write failures
    }
  }, []);

  const reset = useCallback(() => persist({ ...DEFAULT_PLAY_DISPLAY_SETTINGS }), [persist]);
  const setPreset = useCallback((preset: DisplayPreset) => persist(applyPreset(preset, settings)), [persist, settings]);
  const toggle = useCallback((key: keyof PlayDisplaySettings) => persist({ ...settings, [key]: !settings[key] }), [persist, settings]);

  return { settings, hydrated, toggle, reset, setPreset };
}
