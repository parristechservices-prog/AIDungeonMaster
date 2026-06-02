'use client';

import { useEffect, useState } from 'react';

type AmbientType = 'none' | 'tavern' | 'dungeon' | 'combat' | 'exploration' | 'boss_fight';

type Props = {
  type?: AmbientType;
};

/** Scene mood indicator — audio playback is planned; see docs/full-improvement-plan.md §7. */
export function AmbientAudio({ type = 'none' }: Props) {
  const [active, setActive] = useState<AmbientType>(type);

  useEffect(() => {
    if (type && type !== 'none') {
      setActive(type);
    }
  }, [type]);

  if (active === 'none') return null;

  const icons: Record<AmbientType, string> = {
    none: '',
    tavern: '🍺',
    dungeon: '💀',
    combat: '⚔️',
    exploration: '🌲',
    boss_fight: '🔥',
  };

  const labels: Record<AmbientType, string> = {
    none: '',
    tavern: 'Tavern',
    dungeon: 'Dungeon',
    combat: 'Combat',
    exploration: 'Wilderness',
    boss_fight: 'Boss fight',
  };

  return (
    <div
      className="fixed bottom-4 right-4 flex items-center gap-2 rounded-full border border-zinc-300 bg-white/95 px-4 py-2 text-xs text-zinc-800 shadow-sm backdrop-blur-sm dark:border-zinc-600 dark:bg-zinc-900/95 dark:text-zinc-100"
      role="status"
      aria-live="polite"
    >
      <span aria-hidden>{icons[active]}</span>
      <span className="font-medium">Scene mood: {labels[active]}</span>
      <span className="text-zinc-500 dark:text-zinc-400">(audio coming soon)</span>
    </div>
  );
}
