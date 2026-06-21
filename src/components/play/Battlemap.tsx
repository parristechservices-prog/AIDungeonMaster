'use client';

import { useState } from 'react';
import { buildBattlemapView, interpretCellTap, toDisplayCommand, type TokenView } from '@/lib/play/battlemap-view';
import { terrainStyle, coverBadge } from '@/lib/play/dev-panel-format';
import type { TurnResponse } from '@/lib/play/types';

type Props = {
  state: TurnResponse['state'] | null;
  /** DM View: when on, colour terrain/cover; off keeps a player-safe token map. */
  showTerrainOverlay?: boolean;
  /** Receives a suggested (non-submitting) command string for the input box. */
  onSuggestCommand?: (command: string) => void;
};

/**
 * Player-facing tactical battlemap. Renders the deterministic engine BattleMap
 * via the tested view-model and turns taps into SUGGESTED commands only — it
 * never mutates game state (all changes go through the turn/API/engine).
 */
export function Battlemap({ state, showTerrainOverlay = false, onSuggestCommand }: Props) {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const map = state?.combat?.active ? state.combat.battleMap : undefined;

  if (!map) {
    return (
      <section className="rounded border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40" aria-label="Tactical map">
        <p className="font-semibold text-zinc-600 dark:text-zinc-300">No tactical map active</p>
        <p className="mt-1">A battle map appears when combat begins.</p>
        {state?.exploration ? <ExplorationSummary state={state} /> : null}
      </section>
    );
  }

  const currentTurnId = state?.combat?.initiative[state.combat.turnIndex]?.actorId;
  const view = buildBattlemapView(map, { selectedId, currentTurnId });

  const nameOf = (id: string) =>
    state?.party.find((p) => p.id === id)?.name ?? state?.monsters.find((m) => m.id === id)?.name ?? id;
  const hpOf = (id: string) => {
    const p = state?.party.find((x) => x.id === id);
    if (p) return `${p.hp}/${p.maxHp}`;
    const m = state?.monsters.find((x) => x.id === id);
    return m ? `${m.hp}/${m.maxHp}` : '';
  };

  const tokenByCell = new Map<string, TokenView>();
  const footprintCells = new Set<string>();
  for (const t of view.tokens) {
    tokenByCell.set(`${t.x},${t.y}`, t);
    for (let dx = 0; dx < t.span; dx++) for (let dy = 0; dy < t.span; dy++) footprintCells.add(`${t.x + dx},${t.y + dy}`);
  }

  function handleTap(x: number, y: number) {
    if (!map) return;
    const res = interpretCellTap(map, selectedId, x, y);
    if (res.kind === 'select_token') {
      setSelectedId(res.actorId);
      return;
    }
    const command = toDisplayCommand(res, nameOf);
    if (command) onSuggestCommand?.(command);
    // noop interactions intentionally do nothing (no state mutation, no error).
  }

  return (
    <section aria-label="Tactical battle map" className="text-xs">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-semibold text-zinc-600 dark:text-zinc-300">Battle map</p>
        {selectedId ? (
          <button
            onClick={() => setSelectedId(undefined)}
            className="rounded border border-zinc-200 px-2 py-0.5 text-[10px] hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Deselect {nameOf(selectedId)}
          </button>
        ) : (
          <span className="text-[10px] text-zinc-400">Tap a token to select</span>
        )}
      </div>

      <div className="overflow-auto">
        <div
          role="grid"
          aria-label={`${map.width} by ${map.height} battle grid`}
          className="grid w-max gap-0.5"
          style={{ gridTemplateColumns: `repeat(${map.width}, minmax(1.4rem, 1fr))` }}
        >
          {view.cells.map((cell) => {
            const key = `${cell.x},${cell.y}`;
            const token = tokenByCell.get(key);
            const inFootprint = footprintCells.has(key);
            const terrain = showTerrainOverlay ? terrainStyle(cell.terrain) : { className: '', label: 'Normal' };
            const cover = showTerrainOverlay ? coverBadge(cell.cover) : '';
            const tokenClass = token
              ? token.faction === 'party'
                ? 'bg-sky-500 text-white'
                : token.faction === 'monster'
                  ? 'bg-red-600 text-white'
                  : 'bg-zinc-500 text-white'
              : '';
            const label = token
              ? `${nameOf(token.id)} (${token.faction}) ${hpOf(token.id)} at ${cell.x},${cell.y}`
              : `Cell ${cell.x},${cell.y}${showTerrainOverlay && terrain.label !== 'Normal' ? `, ${terrain.label}` : ''}${cell.reachable ? ', reachable' : ''}`;
            return (
              <button
                key={key}
                role="gridcell"
                aria-label={label}
                onClick={() => handleTap(cell.x, cell.y)}
                className={[
                  'relative flex aspect-square min-h-[1.4rem] items-center justify-center rounded-sm border text-[9px] font-bold',
                  'border-zinc-200 dark:border-zinc-800',
                  terrain.className,
                  cell.reachable && !token ? 'ring-1 ring-sky-400/70' : '',
                  inFootprint && !token ? 'outline outline-1 outline-sky-300/50' : '',
                  token?.isSelected ? 'ring-2 ring-amber-400' : '',
                  token?.isCurrentTurn ? 'ring-2 ring-emerald-400' : '',
                  tokenClass,
                ].filter(Boolean).join(' ')}
                title={label}
              >
                {token ? nameOf(token.id).slice(0, 2) : cover}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-2 text-[10px] text-zinc-400">
        Taps suggest a command — nothing happens until you send it. Blue = party, red = enemy
        {showTerrainOverlay ? '; terrain overlay on (DM View)' : ''}.
      </p>
    </section>
  );
}

function ExplorationSummary({ state }: { state: NonNullable<TurnResponse['state']> }) {
  const exploration = state.exploration;
  if (!exploration) return null;
  const areaId = exploration.locations[state.activeCharacterId];
  const area = areaId ? exploration.graph.areas[areaId] : undefined;
  if (!area) return null;
  return (
    <div className="mt-2 border-t border-zinc-200 pt-2 dark:border-zinc-700">
      <p className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">Current area: {area.name}</p>
      {area.connections.length > 0 && (
        <p className="mt-0.5 text-[10px] text-zinc-500">
          Exits: {area.connections.map((c) => exploration.graph.areas[c.to]?.name ?? c.to).join(', ')}
        </p>
      )}
    </div>
  );
}
