'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PartyQuestRecap } from '@/lib/game/recap';
import { clearClientSnapshot } from '@/lib/persistence/client-snapshot';

type Props = {
  sessionId: string;
  playerName: string;
  onNewGame: () => void;
};

export function EndingScreen({ sessionId, playerName, onNewGame }: Props) {
  const [recap, setRecap] = useState<PartyQuestRecap | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/recap?sessionId=${encodeURIComponent(sessionId)}`);
        const data = await res.json();
        if (!cancelled && data.ok) setRecap(data.recap);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  function handleNewGame() {
    clearClientSnapshot();
    onNewGame();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="text-2xl font-bold">Adventure complete</h2>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {playerName} survived <em>The Last Lantern at Brindlehook Inn</em>.
        </p>

        {loading && <p className="mt-4 text-sm text-zinc-500">Loading recap…</p>}

        {!loading && recap && (
          <div className="mt-4 space-y-3 text-sm">
            <p className="italic">&ldquo;{recap.narration}&rdquo;</p>
            <p>
              <span className="font-semibold">Outcome:</span> {recap.outcome}
            </p>
            {recap.consequences.length > 0 && (
              <ul className="list-inside list-disc text-zinc-700 dark:text-zinc-300">
                {recap.consequences.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
            <p className="text-xs text-zinc-500">
              {recap.turnNumber} turns · {recap.mode === 'ai_director' ? 'AI Director' : 'Table rules'}
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleNewGame}
            className="rounded bg-black px-4 py-2 text-white dark:bg-zinc-100 dark:text-black"
          >
            Play again
          </button>
          <Link href="/" className="rounded border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
