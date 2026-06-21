'use client';

import {
  engineResultDetail,
  formatCover,
  formatOpportunityAttack,
  formatRollBreakdown,
  type EngineLogEntry,
} from '@/lib/play/dev-panel-format';

type Props = {
  entries: EngineLogEntry[];
  showCoverLOS: boolean;
  showOpportunityAttacks: boolean;
};

/**
 * Scrollable per-turn log of raw engine requests/results, most recent first.
 * Cover and opportunity-attack detail are gated by their own toggles so each can
 * be shown independently of the base engine log.
 */
export function EngineLogPanel({ entries, showCoverLOS, showOpportunityAttacks }: Props) {
  return (
    <section className="mt-3 rounded border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-900/40">
      <p className="font-semibold text-zinc-600 dark:text-zinc-300">Engine log</p>
      {entries.length === 0 ? (
        <p className="mt-1 italic text-zinc-500">No engine activity yet.</p>
      ) : (
        <div className="mt-2 max-h-80 space-y-3 overflow-y-auto">
          {entries.map((entry) => (
            <div key={entry.turn} className="border-l-2 border-zinc-300 pl-2 dark:border-zinc-700">
              <p className="font-mono text-[10px] text-zinc-500">
                Turn {entry.turn}
                {entry.input ? ` · ${entry.input}` : ''}
              </p>
              {entry.results.length === 0 ? (
                <p className="italic text-zinc-500">No engine requests this turn.</p>
              ) : (
                entry.results.map((result, i) => {
                  const detail = engineResultDetail(result);
                  return (
                    <div key={`${entry.turn}-${i}`} className="mt-1">
                      <p>
                        <span className="font-mono font-semibold">{result.kind}</span>{' '}
                        <span className={result.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          {result.ok ? 'ok' : 'fail'}
                        </span>{' '}
                        — {result.summary}
                      </p>
                      {detail.hasBreakdown && (
                        <p className="ml-2 font-mono text-[10px] text-zinc-500">{formatRollBreakdown(result.breakdown!)}</p>
                      )}
                      {showCoverLOS && result.cover && (
                        <p className="ml-2 text-[10px] text-sky-700 dark:text-sky-300">cover: {formatCover(result.cover)}</p>
                      )}
                      {showOpportunityAttacks && detail.opportunityAttackCount > 0 && (
                        <ul className="ml-2 list-disc pl-3 text-[10px] text-amber-700 dark:text-amber-300">
                          {result.opportunityAttacks!.map((oa, j) => (
                            <li key={j}>{formatOpportunityAttack(oa)}</li>
                          ))}
                        </ul>
                      )}
                      {detail.hasTactical && (
                        <details className="ml-2">
                          <summary className="cursor-pointer text-[10px] text-zinc-500">tactical detail</summary>
                          <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[10px] text-zinc-500">
                            {JSON.stringify(result.tactical, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
