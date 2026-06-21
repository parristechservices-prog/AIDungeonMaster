'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * "DM View" / dev-panel visibility settings. Every section is an opt-in boolean
 * defaulting to OFF so the normal player experience stays clean. This is a pure
 * observability layer — toggles never change game logic, only what the UI shows.
 */
export type DevPanelSettings = {
  showEngineLog: boolean;
  showMonsterStatBlocks: boolean;
  showActionEconomy: boolean;
  showTerrainOverlay: boolean;
  showCoverLOS: boolean;
  showOpportunityAttacks: boolean;
  showNarrationWarnings: boolean;
};

export const DEFAULT_DEV_PANEL_SETTINGS: DevPanelSettings = {
  showEngineLog: false,
  showMonsterStatBlocks: false,
  showActionEconomy: false,
  showTerrainOverlay: false,
  showCoverLOS: false,
  showOpportunityAttacks: false,
  showNarrationWarnings: false,
};

/** Section metadata for rendering the settings checkboxes. */
export const DEV_PANEL_SECTIONS: { key: keyof DevPanelSettings; label: string; hint: string }[] = [
  { key: 'showEngineLog', label: 'Engine log', hint: 'Raw engine requests & results per turn' },
  { key: 'showMonsterStatBlocks', label: 'Monster stat blocks', hint: 'AC, HP, attacks, speed, reach' },
  { key: 'showActionEconomy', label: 'Action economy', hint: 'Movement / action / reaction for every combatant' },
  { key: 'showTerrainOverlay', label: 'Terrain overlay', hint: 'Colour the battle grid by terrain & cover' },
  { key: 'showCoverLOS', label: 'Cover & line of sight', hint: 'Cover AC math behind attacks' },
  { key: 'showOpportunityAttacks', label: 'Opportunity attacks', hint: 'OA rolls triggered by movement' },
  { key: 'showNarrationWarnings', label: 'Narration warnings', hint: 'Engine-vs-prose drift checks' },
];

export const DEV_PANEL_STORAGE_KEY = 'partyquest-dev-panel';

/** Merges an unknown stored value onto the defaults, ignoring unknown/typo keys. */
export function mergeDevPanelSettings(raw: unknown): DevPanelSettings {
  const out: DevPanelSettings = { ...DEFAULT_DEV_PANEL_SETTINGS };
  if (!raw || typeof raw !== 'object') return out;
  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_DEV_PANEL_SETTINGS) as (keyof DevPanelSettings)[]) {
    if (typeof record[key] === 'boolean') out[key] = record[key] as boolean;
  }
  return out;
}

/** Parses a stored JSON string (or null) into settings, falling back to defaults. */
export function parseStoredDevPanelSettings(json: string | null): DevPanelSettings {
  if (!json) return { ...DEFAULT_DEV_PANEL_SETTINGS };
  try {
    return mergeDevPanelSettings(JSON.parse(json));
  } catch {
    return { ...DEFAULT_DEV_PANEL_SETTINGS };
  }
}

/** True when any section is enabled (used to decide whether to render the panel). */
export function anyDevPanelSectionEnabled(settings: DevPanelSettings): boolean {
  return Object.values(settings).some(Boolean);
}

/**
 * React hook backing the dev panel. SSR-safe: starts from defaults at render
 * time and only reads localStorage inside useEffect, so server and first client
 * render match (no hydration mismatch). Writes persist on every change.
 */
export function useDevPanelSettings() {
  const [settings, setSettings] = useState<DevPanelSettings>(DEFAULT_DEV_PANEL_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setSettings(parseStoredDevPanelSettings(window.localStorage.getItem(DEV_PANEL_STORAGE_KEY)));
    } catch {
      // localStorage unavailable (private mode, SSR) — keep defaults.
    }
    setHydrated(true);
  }, []);

  const setSetting = useCallback((key: keyof DevPanelSettings, value: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try {
        window.localStorage.setItem(DEV_PANEL_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore write failures
      }
      return next;
    });
  }, []);

  return { settings, setSetting, hydrated };
}
