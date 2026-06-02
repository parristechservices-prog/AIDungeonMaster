'use client';

import { useEffect, useState } from 'react';

type AmbientType = 'none' | 'tavern' | 'dungeon' | 'combat' | 'exploration' | 'boss_fight';

type Props = {
  type?: AmbientType;
};

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
    tavern: 'Tavern Ambience',
    dungeon: 'Dungeon Depths',
    combat: 'Combat Tension',
    exploration: 'Wilderness Echoes',
    boss_fight: 'Legendary Encounter',
  };

  return (
    <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-full bg-black/80 px-4 py-2 text-xs text-white backdrop-blur-sm transition-all animate-pulse">
      <span>{icons[active]}</span>
      <span className="font-medium">{labels[active]} playing...</span>
    </div>
  );
}
