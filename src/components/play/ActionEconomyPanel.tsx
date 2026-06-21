'use client';

import { actionEconomyRows } from '@/lib/play/dev-panel-format';
import type { TurnResponse } from '@/lib/play/types';

type Props = {
  state: TurnResponse['state'] | null;
};

/** DM-view action economy for every combatant (movement/action/reaction state). */
export function ActionEconomyPanel({ state }: Props) {
  const map = state?.combat.battleMap;
  const activeActorId = state?.combat.initiative[state?.combat.turnIndex]?.actorId;
  const nameOf = (id: string) =>
    state?.party.find((p) => p.id === id)?.name ?? state?.monsters.find((m) => m.id === id)?.name ?? id;
  const isUnconscious = (id: string) =>
    state?.party.some((p) => p.id === id && p.unconscious) || state?.monsters.some((m) => m.id === id && m.hp <= 0) || false;
  const rows = actionEconomyRows(map, nameOf, activeActorId, isUnconscious);

  return (
    <section className="mt-3 rounded border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-900/40">
      <p className="font-semibold text-zinc-600 dark:text-zinc-300">Action economy</p>
      {rows.length === 0 ? (
        <p className="mt-1 italic text-zinc-500">No active battle map.</p>
      ) : (
        <div className="mt-2 space-y-1">
          {rows.map((r) => (
            <div key={r.id} className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {r.name} <span className="text-[9px] uppercase text-zinc-500">{r.faction}</span>
                </span>
                <span className="font-mono text-[10px] text-zinc-500">
                  {r.position ? `${r.position.x},${r.position.y}` : 'no pos'} · {r.movementRemainingFt}/{r.speedFt}
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-zinc-500">
                <span>moved {r.movementSpentFt} ft</span>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-1 text-[9px]">
                <Pill on={!r.actionUsed} label="action" />
                <Pill on={!r.bonusActionUsed} label="bonus" />
                <Pill on={r.reactionAvailable} label="reaction" />
                {r.active && <span className="rounded bg-amber-100 px-1 font-bold uppercase text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">active</span>}
                {r.disengaged && <span className="rounded bg-sky-100 px-1 font-bold uppercase text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">disengaged</span>}
                {r.prone && <span className="rounded bg-amber-100 px-1 font-bold uppercase text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">prone</span>}
                {r.flying && <span className="rounded bg-sky-100 px-1 font-bold uppercase text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">flying</span>}
                {r.unconscious && <span className="rounded bg-red-100 px-1 font-bold uppercase text-red-800 dark:bg-red-900/40 dark:text-red-300">unconscious</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Pill({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`rounded px-1 font-bold uppercase ${
        on ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-zinc-200 text-zinc-500 line-through dark:bg-zinc-800'
      }`}
    >
      {label}
    </span>
  );
}
