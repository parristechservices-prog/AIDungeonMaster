'use client';

import { useEffect, useState } from 'react';

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

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  const [ready, setReady] = useState(false);

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

  return (
    <button
      type="button"
      onClick={toggle}
      className="fixed right-4 top-4 z-50 rounded border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-800 shadow-sm hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      aria-label="Toggle dark mode"
    >
      {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
    </button>
  );
}
