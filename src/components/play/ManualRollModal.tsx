'use client';

import { useState } from 'react';

type Props = {
  context: {
    kind: 'skill_check' | 'player_attack';
    formula: string;
    dc?: number;
  };
  onSubmit: (roll: number) => void;
};

export function ManualRollModal({ context, onSubmit }: Props) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const roll = parseInt(value, 10);
    if (!isNaN(roll) && roll >= 1 && roll <= 20) {
      onSubmit(roll);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h2 className="text-xl font-bold">Physical Roll Required</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          The DM needs a roll for <span className="font-semibold text-black dark:text-white">{context.kind === 'skill_check' ? 'a Skill Check' : 'an Attack'}</span>.
        </p>
        
        <div className="mt-4 rounded-md bg-zinc-100 p-3 dark:bg-zinc-800">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Requirements</p>
          <div className="mt-1 flex justify-between text-sm">
            <span>Formula: <code className="font-mono">{context.formula}</code></span>
            {context.dc && <span>Target DC: <code className="font-mono">{context.dc}</code></span>}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6">
          <label className="block text-sm font-medium">Enter your d20 result (1-20)</label>
          <div className="mt-2 flex gap-2">
            <input
              autoFocus
              type="number"
              min="1"
              max="20"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-center text-2xl font-bold dark:border-zinc-700 dark:bg-zinc-950"
              placeholder="?"
            />
            <button
              type="submit"
              disabled={!value || parseInt(value) < 1 || parseInt(value) > 20}
              className="rounded bg-black px-6 py-2 font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-black"
            >
              Confirm
            </button>
          </div>
        </form>
        
        <p className="mt-4 text-center text-xs text-zinc-500">
          Roll a physical d20 and enter the natural result shown on the die.
        </p>
      </div>
    </div>
  );
}
