'use client';

import { useState } from 'react';
import { buildBattlemapView, interpretCellTap, toDisplayCommand, type TokenView } from '@/lib/play/battlemap-view';
import { buildExplorationMapView } from '@/lib/play/map-view';
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

  // Combat takes priority; outside combat show the exploration (zone) map.
  if (!map) {
    return <ExplorationMap state={state} onSuggestCommand={onSuggestCommand} />;
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

/**
 * Exploration (zone) map for non-combat scenes: current area at top, connected
 * exits and present actors as tappable cards/chips. Taps suggest commands only.
 * Falls back to a useful prompt when no area graph exists for the scene.
 */
function ExplorationMap({
  state,
  onSuggestCommand,
}: {
  state: TurnResponse['state'] | null;
  onSuggestCommand?: (command: string) => void;
}) {
  const view = state ? buildExplorationMapView(state) : null;

  if (!view) {
    const base = ['Where am I?', 'What exits are available?', 'Who is here?'];
    return (
      <section className="rounded border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40" aria-label="Map">
        <p className="font-semibold text-zinc-600 dark:text-zinc-300">No authored map for this scene yet</p>
        <p className="mt-1">You can still ask the DM to orient you:</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {base.map((s) => (
            <button
              key={s}
              onClick={() => onSuggestCommand?.(s)}
              className="rounded-full border border-zinc-300 bg-white px-2 py-1 text-[11px] hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              {s}
            </button>
          ))}
        </div>
      </section>
    );
  }

  // Calculate SVG bounds based on nodes
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  if (view.nodes.length > 0) {
    minX = Math.min(...view.nodes.map(n => n.x));
    maxX = Math.max(...view.nodes.map(n => n.x));
    minY = Math.min(...view.nodes.map(n => n.y));
    maxY = Math.max(...view.nodes.map(n => n.y));
  }
  
  // Pad the bounds slightly so nodes aren't cut off
  const padding = 1.5;
  const vMinX = minX - padding;
  const vMaxX = maxX + padding;
  const vMinY = minY - padding;
  const vMaxY = maxY + padding;
  const width = vMaxX - vMinX;
  const height = vMaxY - vMinY;

  return (
    <section className="text-xs" aria-label="Exploration map">
      
      {/* SVG Map Container */}
      <div className="relative mb-3 aspect-[4/3] w-full rounded border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
        <svg 
          viewBox={`${vMinX} ${vMinY} ${width} ${height}`} 
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Edges */}
          {view.edges.map(edge => {
            const n1 = view.nodes.find(n => n.id === edge.from);
            const n2 = view.nodes.find(n => n.id === edge.to);
            if (!n1 || !n2) return null;
            return (
              <line 
                key={`${edge.from}-${edge.to}`}
                x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} 
                stroke={edge.locked ? 'currentColor' : 'currentColor'}
                strokeWidth={0.05}
                strokeDasharray={edge.locked ? '0.1 0.1' : 'none'}
                className={edge.locked ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-400 dark:text-zinc-600'}
              />
            );
          })}

          {/* Nodes */}
          {view.nodes.map(node => {
            const isKnownExit = view.exits.some(e => e.areaId === node.id);
            const isVisible = node.isCurrent || isKnownExit; // Fade out unknown nodes
            if (!isVisible) return null; // We could render them faintly, but hiding is better for discovery

            return (
              <g 
                key={node.id} 
                transform={`translate(${node.x}, ${node.y})`}
                className={isKnownExit ? 'cursor-pointer' : ''}
                onClick={() => {
                  if (isKnownExit) {
                    const exit = view.exits.find(e => e.areaId === node.id);
                    if (exit && !exit.locked) onSuggestCommand?.(exit.command);
                  }
                }}
              >
                <circle 
                  r={0.4} 
                  fill="currentColor"
                  className={node.isCurrent ? 'text-sky-500' : 'text-zinc-200 hover:text-zinc-300 dark:text-zinc-800 dark:hover:text-zinc-700'} 
                />
                {node.isCurrent && (
                  <circle r={0.5} fill="none" stroke="currentColor" strokeWidth={0.05} className="text-sky-400 opacity-50" />
                )}
                {/* Background for text */}
                <rect x="-1" y="0.5" width="2" height="0.4" fill="currentColor" className="text-zinc-50/80 dark:text-zinc-950/80" rx="0.1" />
                <text 
                  y={0.75} 
                  textAnchor="middle" 
                  fontSize={0.25} 
                  fill="currentColor"
                  className={node.isCurrent ? 'font-bold text-sky-700 dark:text-sky-300' : 'text-zinc-600 dark:text-zinc-400 font-medium'}
                  pointerEvents="none"
                >
                  {node.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Compass Overlay */}
        <div className="absolute top-2 right-2 flex flex-col items-center opacity-40 pointer-events-none">
          <span className="text-[10px] font-bold">N</span>
          <div className="flex items-center">
            <span className="text-[10px] font-bold mr-1">W</span>
            <div className="w-4 h-4 border rounded-full relative">
              <div className="absolute w-full h-px bg-current top-1/2 left-0 -translate-y-1/2" />
              <div className="absolute h-full w-px bg-current left-1/2 top-0 -translate-x-1/2" />
            </div>
            <span className="text-[10px] font-bold ml-1">E</span>
          </div>
          <span className="text-[10px] font-bold">S</span>
        </div>
      </div>

      <div className="rounded border border-sky-300 bg-sky-50 p-2 dark:border-sky-800 dark:bg-sky-950/30">
        <p className="text-[10px] font-bold uppercase tracking-widest text-sky-700 dark:text-sky-300">You are here</p>
        <p className="font-semibold text-zinc-800 dark:text-zinc-100">{view.currentAreaName}</p>
        {view.currentAreaDescription && <p className="mt-0.5 text-[11px] text-zinc-500">{view.currentAreaDescription}</p>}
      </div>

      {view.actorsPresent.length > 0 && (
        <>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Present</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {view.actorsPresent.map((a) => (
              <button
                key={a.id}
                onClick={() => onSuggestCommand?.(a.command)}
                className="rounded-full border border-zinc-300 bg-white px-2 py-1 text-[11px] hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              >
                {a.name} <span className="text-[9px] uppercase text-zinc-400">{a.kind}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {view.baseSuggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestCommand?.(s)}
            className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {s}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-zinc-400">Tap nodes on the map to suggest movement commands.</p>
    </section>
  );
}
