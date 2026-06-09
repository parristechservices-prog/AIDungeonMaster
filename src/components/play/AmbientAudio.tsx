'use client';

import { useEffect, useState } from 'react';

type AmbientType = 'none' | 'tavern' | 'dungeon' | 'combat' | 'exploration' | 'boss_fight';

type Props = {
  type?: AmbientType;
};

/** Scene mood indicator with volume controls. */
export function AmbientAudio({ type = 'none' }: Props) {
  const [active, setActive] = useState<AmbientType>(type);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);

  useEffect(() => {
    if (type && type !== 'none') {
      setActive(type);
      // Auto-play when scene changes if volume > 0
      if (volume > 0) setIsPlaying(true);
    }
  }, [type, volume]);

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
      className="fixed bottom-4 right-4 flex flex-col gap-2 items-end z-50"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 rounded-full border border-zinc-300 bg-white/95 px-4 py-2 text-xs text-zinc-800 shadow-lg backdrop-blur-sm dark:border-zinc-600 dark:bg-zinc-900/95 dark:text-zinc-100 transition-all hover:scale-105">
        <button 
          onClick={() => setIsPlaying(!isPlaying)}
          className="hover:scale-110 transition-transform"
          aria-label={isPlaying ? 'Pause ambient' : 'Play ambient'}
        >
          {isPlaying ? '⏸️' : '▶️'}
        </button>
        
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span aria-hidden>{icons[active]}</span>
            <span className="font-medium">{labels[active]}</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-24 h-1 mt-1 accent-zinc-800 dark:accent-zinc-200"
          />
        </div>
      </div>
      {isPlaying && (
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 animate-pulse px-2 bg-zinc-900/10 dark:bg-zinc-100/10 rounded-full">
          Playing ambiance...
        </span>
      )}
    </div>
  );
}
