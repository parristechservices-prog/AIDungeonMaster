'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('partyquest-theme') as Theme | null;
    const initial = saved ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(initial);
  }, []);

  const applyTheme = (next: Theme) => {
    if (typeof window === 'undefined') return;
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(next);
    localStorage.setItem('partyquest-theme', next);
  };

  useEffect(() => {
    if (mounted) {
      applyTheme(theme);
    }
  }, [theme, mounted]);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }

  if (!mounted) {
    return null;
  }

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
