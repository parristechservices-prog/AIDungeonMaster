'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

type Theme = 'light' | 'dark';

function readTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem('partyquest-theme') as Theme | null;
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(next: Theme) {
  document.documentElement.classList.remove('light', 'dark');
  document.documentElement.classList.add(next);
  localStorage.setItem('partyquest-theme', next);
}

type Props = {
  /** Floating (fixed top-right) for global use; inline for headers. */
  floating?: boolean;
  className?: string;
};

export function ThemeToggle({ floating = true, className }: Props) {
  const [theme, setTheme] = useState<Theme>('light');
  const [ready, setReady] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const initial = readTheme();
    applyTheme(initial);
    setTheme(initial);
    setReady(true);
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  }

  if (!ready) return null;
  // /play owns its own inline theme button in the header, so the global floating
  // toggle hides there to avoid overlapping the play header controls.
  if (floating && pathname?.startsWith('/play')) return null;

  const base = 'rounded border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-800 shadow-sm hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800';
  return (
    <button
      type="button"
      onClick={toggle}
      className={floating ? `fixed right-4 top-4 z-50 ${base}` : (className ?? base)}
      aria-label="Toggle dark mode"
    >
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  );
}
