'use client';

import { monsterAttackLines, monsterReachFt, monsterSpeedFt, type MonsterView } from '@/lib/play/dev-panel-format';

type Props = {
  monsters: MonsterView[];
};

/** DM-view monster stat blocks: AC, HP, attacks, speed, reach, conditions. */
export function MonsterStatBlock({ monsters }: Props) {
  return (
    <section className="mt-3 rounded border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-900/40">
      <p className="font-semibold text-zinc-600 dark:text-zinc-300">Monster stat blocks</p>
      {monsters.length === 0 ? (
        <p className="mt-1 italic text-zinc-500">No visible monsters.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {monsters.map((m) => (
            <div key={m.id} className="rounded border border-zinc-200 p-2 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <p className="font-bold">
                  {m.name}
                  {m.size && m.size !== 'medium' ? <span className="ml-1 text-[9px] uppercase text-zinc-500">{m.size}</span> : null}
                </p>
                <p className="font-mono">{m.hp}/{m.maxHp} HP</p>
              </div>
              <p className="font-mono text-[10px] text-zinc-500">
                AC {m.ac} · speed {monsterSpeedFt(m)} ft · reach {monsterReachFt(m)} ft
              </p>
              {monsterAttackLines(m).map((line, i) => (
                <p key={i} className="text-[10px] text-zinc-600 dark:text-zinc-400">• {line}</p>
              ))}
              {m.conditions.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {m.conditions.map((c) => (
                    <span key={c} className="rounded bg-amber-100 px-1 py-0.5 text-[8px] font-bold uppercase text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
