import type { GameState } from '@/lib/game/types';
import { getCell, remainingMovementFt } from '@/lib/engine/spatial/tactical';
import { coverBadge, terrainLegendFor, terrainStyle } from '@/lib/play/dev-panel-format';

type Props = {
  combat: GameState['combat'];
  party: { id: string; name: string }[];
  monsters: { id: string; name: string; hp: number; maxHp: number }[];
  showTerrainOverlay?: boolean;
};

function actorLabel(actorId: string, party: Props['party'], monsters: Props['monsters']): string {
  const partyMember = party.find((member) => member.id === actorId);
  if (partyMember) return partyMember.name;
  return monsters.find((m) => m.id === actorId)?.name ?? actorId;
}

export function CombatHUD({ combat, party, monsters, showTerrainOverlay = false }: Props) {
  if (!combat.active || combat.initiative.length === 0) return null;

  const current = combat.initiative[combat.turnIndex];
  const grid = combat.battleMap;
  const activeActor = grid && current ? grid.actors[current.actorId] : undefined;
  const actorsByCell = new Map<string, { id: string; label: string; kind: 'party' | 'monster'; defeated?: boolean; anchor: boolean }>();

  if (grid) {
    // Large creatures fill 2x2 squares, Huge 3x3, Gargantuan 4x4 (5e).
    const span = (id: string) => ({ large: 2, huge: 3, gargantuan: 4 } as Record<string, number>)[grid.actors[id]?.size ?? 'medium'] ?? 1;
    const place = (id: string, label: string, kind: 'party' | 'monster', defeated?: boolean) => {
      const position = grid.positions[id];
      if (!position) return;
      const n = span(id);
      for (let dx = 0; dx < n; dx++) {
        for (let dy = 0; dy < n; dy++) {
          actorsByCell.set(`${position.x + dx},${position.y + dy}`, { id, label, kind, defeated, anchor: dx === 0 && dy === 0 });
        }
      }
    };
    party.forEach((member) => place(member.id, member.name.slice(0, 2), 'party'));
    // Number same-named foes (W1, W2) so they can be told apart.
    const counts = new Map<string, number>();
    monsters.forEach((m) => counts.set(m.name, (counts.get(m.name) ?? 0) + 1));
    const seen = new Map<string, number>();
    monsters.forEach((monster) => {
      const k = (seen.get(monster.name) ?? 0) + 1;
      seen.set(monster.name, k);
      const label = (counts.get(monster.name) ?? 1) > 1 ? `${monster.name.slice(0, 1)}${k}` : monster.name.slice(0, 2);
      place(monster.id, label, 'monster', monster.hp <= 0);
    });
  }

  const terrainLegend = showTerrainOverlay && grid ? terrainLegendFor(grid) : [];

  return (
    <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-xs dark:border-red-900 dark:bg-red-950/30">
      <p className="font-semibold text-red-900 dark:text-red-200">Combat - initiative</p>

      {activeActor && (
        <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
          {actorLabel(current.actorId, party, monsters)}: {remainingMovementFt(activeActor)} ft movement ·{' '}
          action {activeActor.actionUsed ? 'used' : 'ready'} ·{' '}
          reaction {activeActor.reactionAvailable ? 'ready' : 'used'}
        </p>
      )}

      {grid && (
        <div className="mt-3" aria-label="Tactical combat grid">
          <div
            className="grid max-w-sm gap-1"
            style={{ gridTemplateColumns: `repeat(${grid.width}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: grid.width * grid.height }).map((_, index) => {
              const x = index % grid.width;
              const y = Math.floor(index / grid.width);
              const actor = actorsByCell.get(`${x},${y}`);
              const isCurrent = actor?.id === current?.actorId;
              const cell = getCell(grid, { x, y, z: 0 });
              const terrain = showTerrainOverlay ? terrainStyle(cell.terrain) : undefined;
              const cover = showTerrainOverlay ? coverBadge(cell.cover ?? 'none') : '';
              const actorClasses = actor?.kind === 'party'
                ? 'border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200'
                : actor?.kind === 'monster'
                  ? 'border-red-300 bg-red-100 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200'
                  : 'border-zinc-200 bg-white/70 dark:border-zinc-800 dark:bg-zinc-950/40';
              const cellClasses = terrain?.className || actorClasses;

              return (
                <div
                  key={`${x}-${y}`}
                  className={`relative flex aspect-square items-center justify-center rounded border text-[10px] font-bold ${cellClasses} ${isCurrent ? 'ring-2 ring-amber-400' : ''} ${actor?.defeated ? 'opacity-40 line-through' : ''}`}
                  title={actor ? actorLabel(actor.id, party, monsters) : `Space ${x + 1}, ${y + 1}`}
                >
                  {actor?.anchor ? actor.label : ''}
                  {cover ? (
                    <span className="absolute right-1 top-1 text-[9px] text-zinc-700 dark:text-zinc-200">{cover}</span>
                  ) : null}
                </div>
              );
            })}
          </div>
          <p className="mt-1 text-[10px] text-zinc-500">Blue is party, red is enemy, gold ring is the active turn.</p>
          {showTerrainOverlay && terrainLegend.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-zinc-600 dark:text-zinc-400">
              {terrainLegend.map((entry) => (
                <span key={entry.label} className={`rounded border px-2 py-1 ${entry.className || 'bg-zinc-100 dark:bg-zinc-800'} text-[10px]`}>{entry.label}</span>
              ))}
            </div>
          ) : null}
        </div>
      )}

      <ol className="mt-2 space-y-1">
        {combat.initiative.map((entry, i) => {
          const label = actorLabel(entry.actorId, party, monsters);
          const isCurrent = current?.actorId === entry.actorId;
          return (
            <li
              key={`${entry.actorId}-${i}`}
              className={isCurrent ? 'font-semibold text-red-800 dark:text-red-100' : 'text-zinc-700 dark:text-zinc-300'}
            >
              {i + 1}. {label} (rolled {entry.roll})
              {isCurrent ? ' - active' : ''}
            </li>
          );
        })}
      </ol>

      <div className="mt-3 grid gap-1 sm:grid-cols-2" aria-label="Monster status">
        {monsters.map((monster) => (
          <p
            key={monster.id}
            className={monster.hp <= 0 ? 'text-zinc-500 line-through' : 'text-red-900 dark:text-red-200'}
          >
            {monster.name}: {monster.hp <= 0 ? 'defeated' : 'active'}
          </p>
        ))}
      </div>
    </div>
  );
}
