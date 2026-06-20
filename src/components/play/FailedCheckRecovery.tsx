type Props = {
  failedResult?: { kind: string; summary: string; ok: boolean };
  choices: string[];
};

export function FailedCheckRecovery({ failedResult, choices }: Props) {
  if (!failedResult || failedResult.ok || failedResult.kind !== 'skill_check') return null;

  return (
    <aside
      className="mt-4 rounded-2xl border-2 border-amber-400 bg-amber-50 p-5 text-sm text-amber-950 shadow-lg dark:border-amber-500 dark:bg-amber-950/60 dark:text-amber-100 animate-in fade-in slide-in-from-bottom-4 duration-300"
      aria-label="Failed check recovery"
      role="alert"
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
      </div>
    </aside>
  );
}
