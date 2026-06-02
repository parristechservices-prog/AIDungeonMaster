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
          <li key={`${r.formula}-${i}`} className="flex flex-col gap-0.5 border-b border-amber-200/50 pb-1 last:border-0 dark:border-amber-900/50">
            <div className="flex justify-between items-center">
              <span className="font-mono text-amber-950 dark:text-amber-100">
                {r.formula}
                {r.modifier !== 0 ? ` ${r.modifier >= 0 ? '+' : ''}${r.modifier}` : ''}: [
                {r.rolls.map((val, idx) => (
                  <span key={idx} className={r.keptRoll === val ? 'font-bold underline' : 'opacity-60'}>
                    {val}{idx < r.rolls.length - 1 ? ', ' : ''}
                  </span>
                ))}] = <strong>{r.total}</strong>
              </span>
              {r.dc !== undefined && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter ${r.ok ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'}`}>
                  {r.ok ? 'Pass' : 'Fail'} (DC {r.dc})
                </span>
              )}
            </div>
            {(r.advantage || r.disadvantage) && (
              <span className="text-[10px] italic opacity-70">
                Rolling with {r.advantage ? 'Advantage' : 'Disadvantage'}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
