import type { GameState } from '@/lib/game/types';

type Props = {
  combat: GameState['combat'];
  party: { id: string; name: string }[];
  monsters: { id: string; name: string; hp: number; maxHp: number }[];
};

function actorLabel(actorId: string, party: Props['party'], monsters: Props['monsters']): string {
  const partyMember = party.find((member) => member.id === actorId);
  if (partyMember) return partyMember.name;
  return monsters.find((m) => m.id === actorId)?.name ?? actorId;
}

export function CombatHUD({ combat, party, monsters }: Props) {
  if (!combat.active || combat.initiative.length === 0) return null;

  const current = combat.initiative[combat.turnIndex];
  const grid = combat.grid;
  const actorsByCell = new Map<string, { id: string; label: string; kind: 'party' | 'monster'; defeated?: boolean }>();

  if (grid) {
    party.forEach((member) => {
      const position = grid.positions[member.id];
      if (position) {
        actorsByCell.set(`${position.x},${position.y}`, {
          id: member.id,
          label: member.name.slice(0, 2),
          kind: 'party',
        });
      }
    });
    monsters.forEach((monster) => {
      const position = grid.positions[monster.id];
      if (position) {
        actorsByCell.set(`${position.x},${position.y}`, {
          id: monster.id,
          label: monster.name.slice(0, 2),
          kind: 'monster',
          defeated: monster.hp <= 0,
        });
      }
    });
  }

  return (
    <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-xs dark:border-red-900 dark:bg-red-950/30">
      <p className="font-semibold text-red-900 dark:text-red-200">Combat - initiative</p>

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

              return (
                <div
                  key={`${x}-${y}`}
                  className={`flex aspect-square items-center justify-center rounded border text-[10px] font-bold ${
                    actor?.kind === 'party'
                      ? 'border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200'
                      : actor?.kind === 'monster'
                        ? 'border-red-300 bg-red-100 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200'
                        : 'border-zinc-200 bg-white/70 dark:border-zinc-800 dark:bg-zinc-950/40'
                  } ${isCurrent ? 'ring-2 ring-amber-400' : ''} ${actor?.defeated ? 'opacity-40 line-through' : ''}`}
                  title={actor ? actorLabel(actor.id, party, monsters) : `Space ${x + 1}, ${y + 1}`}
                >
                  {actor?.label ?? ''}
                </div>
              );
            })}
          </div>
          <p className="mt-1 text-[10px] text-zinc-500">Blue is party, red is enemy, gold ring is the active turn.</p>
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
