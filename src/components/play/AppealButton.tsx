'use client';

import { useMemo, useState } from 'react';
import type { RollBreakdown } from '@/lib/engine/types';
import type { TurnResponse } from '@/lib/play/types';

type Props = {
  busy: boolean;
  lastEngineResults: TurnResponse['engineResults'];
  recentRolls: RollBreakdown[];
  state: TurnResponse['state'] | null;
  onAppeal: (detail: string) => void;
};

function formatRoll(roll?: RollBreakdown) {
  if (!roll) return 'No dice were rolled.';
  const dc = roll.dc === undefined ? '' : ` vs DC ${roll.dc}`;
  return `${roll.formula}: ${roll.rolls.join(', ')} = ${roll.total}${dc}`;
}

export function AppealButton({ busy, lastEngineResults, recentRolls, state, onAppeal }: Props) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState('');
  const latestResult = lastEngineResults.at(-1);
  const latestRoll = recentRolls.at(-1);
  const activeCharacter = state?.party.find((member) => member.id === state.activeCharacterId) ?? state?.party[0];

  const defaultAppeal = useMemo(() => {
    const parts = [
      'I want to question the last ruling.',
      latestResult ? `Ruling: ${latestResult.summary}` : undefined,
      latestRoll ? `Roll: ${formatRoll(latestRoll)}` : undefined,
      activeCharacter ? `Active character: ${activeCharacter.name}, HP ${activeCharacter.hp}/${activeCharacter.maxHp}, AC ${activeCharacter.ac}.` : undefined,
    ].filter(Boolean);
    return parts.join(' ');
  }, [activeCharacter, latestResult, latestRoll]);

  function submitAppeal() {
    onAppeal(detail.trim() || defaultAppeal);
    setDetail('');
    setOpen(false);
  }

  return (
    <div className="mt-3 rounded border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-950">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
        className="font-semibold text-zinc-700 underline hover:text-zinc-950 disabled:opacity-50 dark:text-zinc-300 dark:hover:text-white"
        title="Question a ruling or ask the DM to reconsider."
      >
        Appeal the DM
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="font-bold uppercase tracking-wider text-zinc-400">Last Ruling</p>
            <p className="mt-1 text-zinc-700 dark:text-zinc-300">{latestResult?.summary ?? 'No mechanical ruling recorded yet.'}</p>
            <p className="mt-1 font-mono text-[11px] text-zinc-500">{formatRoll(latestRoll)}</p>
          </div>

          <textarea
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            rows={3}
            className="w-full resize-none rounded border border-zinc-300 bg-white p-2 text-xs outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="What should the DM reconsider?"
          />

          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={submitAppeal}
              className="rounded bg-zinc-900 px-3 py-1.5 font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950"
            >
              Send appeal
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded border border-zinc-200 px-3 py-1.5 font-semibold text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
