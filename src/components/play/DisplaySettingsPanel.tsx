'use client';

import { useState } from 'react';
import {
  DISPLAY_SECTIONS,
  type DisplayPreset,
  type PlayDisplaySettings,
} from '@/lib/play/display-settings';

type Props = {
  settings: PlayDisplaySettings;
  toggle: (key: keyof PlayDisplaySettings) => void;
  reset: () => void;
  setPreset: (preset: DisplayPreset) => void;
};

const PRESETS: { id: DisplayPreset; label: string }[] = [
  { id: 'full', label: 'Full UI' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'combat', label: 'Combat' },
  { id: 'story', label: 'Story' },
];

/**
 * "Display" opener (always visible) + a panel of show/hide toggles. The opener
 * itself is never gated by settings, so the player can always restore the UI.
 * On mobile it opens as a bottom sheet; on desktop as a right-aligned popover.
 */
export function DisplaySettingsPanel({ settings, toggle, reset, setPreset }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Display settings — show or hide UI sections"
        className="rounded border border-zinc-200 px-2 py-1 text-[11px] font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Display
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-5 text-sm dark:bg-zinc-900 sm:rounded-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Display settings"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Display settings</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded border border-zinc-200 px-3 py-1 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Close
              </button>
            </div>

            {/* Presets */}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPreset(p.id)}
                  className="rounded-full border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={reset}
                className="rounded-full border border-amber-300 px-3 py-1 text-xs text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/30"
              >
                Reset layout
              </button>
            </div>

            {/* Compact mode */}
            <label className="mb-3 flex cursor-pointer items-center justify-between rounded border border-zinc-200 px-3 py-2 dark:border-zinc-700">
              <span className="font-medium">Compact mode</span>
              <input type="checkbox" checked={settings.compactMode} onChange={() => toggle('compactMode')} className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700" />
            </label>

            {/* Section toggles */}
            {DISPLAY_SECTIONS.map((section) => (
              <div key={section.group} className="mb-3">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400">{section.group}</p>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <label
                      key={item.key}
                      className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <span>{item.label}</span>
                      <input
                        type="checkbox"
                        checked={settings[item.key]}
                        onChange={() => toggle(item.key)}
                        className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <p className="mt-2 text-[10px] text-zinc-400">The Display button always stays visible, so you can never hide your way out.</p>
          </div>
        </div>
      )}
    </>
  );
}
