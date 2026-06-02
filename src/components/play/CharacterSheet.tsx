'use client';

import { useState } from 'react';
import type { TurnResponse } from '@/lib/play/types';
import type { Character } from '@/lib/game/types';

type State = TurnResponse['state'];

type Props = {
  state: State | null;
};

const emptyCharacter: Character = {
  id: 'unknown',
  name: 'Unknown',
  race: 'Unknown',
  className: 'Unknown',
  level: 0,
  ac: 0,
  maxHp: 1,
  hp: 0,
  proficiencyBonus: 0,
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  skills: {},
  features: [],
  spellSlots: {},
  weapon: { name: 'Fists', attackBonus: 0, damage: '1d1' },
  gold: 0,
  inventory: [],
  deathSaves: { success: 0, failure: 0 },
  unconscious: false,
  conditions: [],
};

export function CharacterSheet({ state }: Props) {
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);

  if (!state || state.party?.length === 0) {
    return <p className="mt-2 text-zinc-600">Send your first action to begin.</p>;
  }

  const party = state.party ?? [];
  const activeCharId = selectedCharId || state.activeCharacterId || party[0]?.id;
  const char = party.find(p => p.id === activeCharId) || party[0] || emptyCharacter;

  return (
    <div className="flex flex-col h-full">
      {/* Character Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2 border-b border-zinc-200 dark:border-zinc-800">
        {state.party.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedCharId(p.id)}
            className={`px-2 py-1 text-[10px] font-bold uppercase rounded transition-colors whitespace-nowrap ${
              char.id === p.id
                ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
            }`}
          >
            {p.name.split(' ')[0]} {p.hp === 0 ? '💀' : ''}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pt-3">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-bold text-lg leading-none">{char.name}</p>
            <p className="text-xs text-zinc-500 mt-1">
              Level {char.level} {char.race} {char.className} {char.subclass && `(${char.subclass})`}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${char.hp === 0 ? 'bg-red-500' : 'bg-green-500'}`}
                style={{ width: `${(char.hp / char.maxHp) * 100}%` }}
              />
            </div>
            <p className={`text-xs font-mono font-bold ${char.hp === 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
              {char.hp}/{char.maxHp}
            </p>
          </div>

          {char.unconscious && (
            <div className="text-[10px] bg-red-50 dark:bg-red-950/30 p-2 rounded border border-red-200 dark:border-red-900">
              <p className="font-bold uppercase tracking-wider mb-1">Death Saves</p>
              <div className="flex gap-4">
                <span className="flex items-center gap-1">Success: <span className="font-mono">{char.deathSaves.success}/3</span></span>
                <span className="flex items-center gap-1">Failure: <span className="font-mono">{char.deathSaves.failure}/3</span></span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded border border-zinc-100 dark:border-zinc-800">
              <p className="text-zinc-500 uppercase text-[9px] font-bold">Armor Class</p>
              <p className="font-mono text-base font-bold">{char.ac}</p>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded border border-zinc-100 dark:border-zinc-800">
              <p className="text-zinc-500 uppercase text-[9px] font-bold">Wealth</p>
              <p className="font-mono text-base font-bold">{char.gold}gp</p>
            </div>
          </div>

          {char.conditions?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {char.conditions.map(c => (
                <span key={c} className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>

        <p className="mt-4 font-bold text-xs uppercase text-zinc-400 tracking-widest">Inventory</p>
        <div className="mt-1 max-h-32 overflow-y-auto text-xs">
          {char.inventory?.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {char.inventory.map((item, i) => (
                <span key={`${item}-${i}`} className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-[10px]">
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <p className="italic text-zinc-500">Empty.</p>
          )}
        </div>

        <p className="mt-4 font-bold text-xs uppercase text-zinc-400 tracking-widest">Features & Spells</p>
        <div className="mt-1 space-y-1">
          {char.features.map((f) => (
            <div key={f.id} className="flex justify-between items-center text-xs">
              <span>{f.name}</span>
              <span className="font-mono text-zinc-500">{f.usesRemaining}/{f.usesMax}</span>
            </div>
          ))}
          {Object.entries(char.spellSlots).map(([lvl, s]) => (
            <div key={lvl} className="flex justify-between items-center text-xs">
              <span>Level {lvl} Slots</span>
              <span className="font-mono text-zinc-500">{s.remaining}/{s.max}</span>
            </div>
          ))}
        </div>

        <p className="mt-6 font-bold text-xs uppercase text-zinc-400 tracking-widest">Enemies</p>
        <div className="mt-1 space-y-2">
          {state.monsters?.length > 0 ? (
            state.monsters.map((m) => (
              <div key={m.id} className="text-xs bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded border border-zinc-100 dark:border-zinc-800">
                <div className="flex justify-between items-center">
                  <p className="font-bold">{m.name}</p>
                  <p className="font-mono">{m.hp}/{m.maxHp} HP</p>
                </div>
                {m.conditions?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {m.conditions.map(c => (
                      <span key={c} className="rounded bg-zinc-200 px-1 py-0.5 text-[8px] font-bold uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="italic text-zinc-500 text-xs">None visible.</p>
          )}
        </div>

        <p className="mt-6 font-bold text-xs uppercase text-zinc-400 tracking-widest">Nearby NPCs</p>
        <div className="mt-1 space-y-1">
          {state.npcs?.length > 0 ? (
            state.npcs.map((n) => (
              <p key={n.id} className="text-xs" title={n.description}>
                • {n.name} <span className="text-zinc-500">({n.disposition})</span>
              </p>
            ))
          ) : (
            <p className="italic text-zinc-500 text-xs">None nearby.</p>
          )}
        </div>

        <p className="mt-6 font-bold text-xs uppercase text-zinc-400 tracking-widest">Canon Log</p>
        <div className="mt-1 max-h-40 overflow-y-auto border-l-2 border-zinc-100 dark:border-zinc-800 pl-3">
          {state.canonLog?.length > 0 ? (
            state.canonLog.map((f) => (
              <p key={f.id} className="mb-2 text-[11px] text-zinc-600 dark:text-zinc-400 italic">
                &quot;{f.content}&quot;
              </p>
            ))
          ) : (
            <p className="italic text-zinc-500 text-xs">No facts established yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
