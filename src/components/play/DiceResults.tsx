import type { RollBreakdown } from '@/lib/engine/types';

type Props = {
  rolls: RollBreakdown[];
};

export function DiceResults({ rolls }: Props) {
  if (rolls.length === 0) return null;

  return (
    <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/40">
      <p className="font-semibold text-amber-900 dark:text-amber-200">Dice</p>
      <ul className="mt-1 space-y-1">
        {rolls.map((r, i) => (
          <li key={`${r.formula}-${i}`} className="font-mono text-amber-950 dark:text-amber-100">
            {r.formula}
            {r.modifier !== 0 ? ` ${r.modifier >= 0 ? '+' : ''}${r.modifier}` : ''}: [
            {r.rolls.join(', ')}] = <strong>{r.total}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
