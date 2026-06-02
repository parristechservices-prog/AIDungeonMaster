import type { GameState } from '@/lib/game/types';

type Props = {
  combat: GameState['combat'];
  playerName: string;
  monsters: { id: string; name: string; hp: number; maxHp: number }[];
};

function actorLabel(actorId: string, playerName: string, monsters: Props['monsters']): string {
  if (actorId === 'player' || actorId.startsWith('pc-')) return playerName;
  if (actorId.includes('fighter') || actorId.includes('seren')) return playerName;
  return monsters.find((m) => m.id === actorId)?.name ?? actorId;
}

export function CombatHUD({ combat, playerName, monsters }: Props) {
  if (!combat.active || combat.initiative.length === 0) return null;

  const current = combat.initiative[combat.turnIndex];

  return (
    <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-xs dark:border-red-900 dark:bg-red-950/30">
      <p className="font-semibold text-red-900 dark:text-red-200">Combat — initiative</p>
      <ol className="mt-2 space-y-1">
        {combat.initiative.map((entry, i) => {
          const label = actorLabel(entry.actorId, playerName, monsters);
          const isCurrent = current?.actorId === entry.actorId;
          return (
            <li
              key={`${entry.actorId}-${i}`}
              className={isCurrent ? 'font-semibold text-red-800 dark:text-red-100' : 'text-zinc-700 dark:text-zinc-300'}
            >
              {i + 1}. {label} (rolled {entry.roll})
              {isCurrent ? ' ← active' : ''}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
