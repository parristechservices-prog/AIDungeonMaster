'use client';

import { useState } from 'react';
import { DEV_PANEL_SECTIONS, type DevPanelSettings } from '@/lib/play/dev-panel';

type Props = {
  settings: DevPanelSettings;
  setSetting: (key: keyof DevPanelSettings, value: boolean) => void;
};

/** Gear button that opens a checkbox list of dev-panel ("DM View") sections. */
export function DevPanelToggle({ settings, setSetting }: Props) {
  const [open, setOpen] = useState(false);
  const activeCount = Object.values(settings).filter(Boolean).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="DM View — show behind-the-scenes engine info"
        className="rounded border border-zinc-200 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        DM View{activeCount > 0 ? ` (${activeCount})` : ''}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-1 w-64 rounded border border-zinc-200 bg-white p-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <p className="mb-1 px-1 font-semibold text-zinc-500">Show engine internals</p>
          {DEV_PANEL_SECTIONS.map((section) => (
            <label
              key={section.key}
              className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              title={section.hint}
            >
              <input
                type="checkbox"
                checked={settings[section.key]}
                onChange={(e) => setSetting(section.key, e.target.checked)}
                className="mt-0.5 rounded border-zinc-300 dark:border-zinc-700"
              />
              <span>
                <span className="font-medium">{section.label}</span>
                <span className="block text-[10px] text-zinc-500">{section.hint}</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
