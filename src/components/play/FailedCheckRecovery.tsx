'use client';

import { useEffect, useRef, useState } from 'react';

type FailedResult = { kind: string; summary: string; ok: boolean };

type Props = {
  failedResult?: FailedResult;
  choices: string[];
};

/** Pure visibility rule: the recovery hint is for a failed skill check only. */
export function isRecoveryVisible(failedResult?: FailedResult): boolean {
  return !!failedResult && !failedResult.ok && failedResult.kind === 'skill_check';
}

/**
 * Inline, dismissible recovery hint shown after a failed skill check. It can be
 * closed (button, Escape) and auto-dismisses after a few seconds. Dismissal is
 * purely local UI state — it never touches game state or narration history — and
 * a NEW failed check re-shows it.
 */
export function FailedCheckRecovery({ failedResult, choices }: Props) {
  const visible = isRecoveryVisible(failedResult);
  const signature = visible ? failedResult!.summary : '';
  const [dismissed, setDismissed] = useState(false);
  const prevSignature = useRef('');

  // A new failure (different summary) resets the dismissed state so it re-appears.
  useEffect(() => {
    if (signature && signature !== prevSignature.current) {
      prevSignature.current = signature;
      setDismissed(false);
    }
  }, [signature]);

  // Auto-dismiss non-critical hint after ~6s.
  useEffect(() => {
    if (!visible || dismissed) return;
    const timer = setTimeout(() => setDismissed(true), 6000);
    return () => clearTimeout(timer);
  }, [visible, dismissed, signature]);

  // Escape dismisses it.
  useEffect(() => {
    if (!visible || dismissed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDismissed(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, dismissed]);

  if (!visible || dismissed) return null;

  return (
    <aside
      className="mt-4 rounded-2xl border-2 border-amber-400 bg-amber-50 p-5 text-sm text-amber-950 shadow-lg dark:border-amber-500 dark:bg-amber-950/60 dark:text-amber-100 animate-in fade-in slide-in-from-bottom-4 duration-300"
      aria-label="Failed check recovery"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="text-3xl" aria-hidden="true">💡</div>
        <div className="flex-1">
          <p className="font-bold text-lg">That approach didn&apos;t work this time.</p>
          <p className="mt-1 opacity-90">
            Try another angle: ask a question, examine something closely, or pick a suggested action.
          </p>
          {choices.length > 0 && (
            <p className="mt-3 text-xs font-semibold bg-amber-100 dark:bg-amber-900/70 rounded-xl px-3 py-2">
              Suggested next step: <span className="underline">{choices[0]}</span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss message"
          className="shrink-0 rounded-full border border-amber-300 px-2 py-0.5 text-base leading-none text-amber-800 hover:bg-amber-100 focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/60"
        >
          ✕
        </button>
      </div>
    </aside>
  );
}
