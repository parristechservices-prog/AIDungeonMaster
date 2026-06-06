type Props = {
  failedResult?: { kind: string; summary: string; ok: boolean };
  choices: string[];
};

export function FailedCheckRecovery({ failedResult, choices }: Props) {
  if (!failedResult || failedResult.ok || failedResult.kind !== 'skill_check') return null;

  return (
    <aside
      className="mt-3 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100"
      aria-label="Failed check recovery"
    >
      <p className="font-semibold">That approach did not work, but the scene is still open.</p>
      <p className="mt-1 text-xs opacity-80">
        Try another approach, ask a question, inspect something specific, or choose a suggested action.
      </p>
      {choices.length > 0 && (
        <p className="mt-2 text-xs">
          A useful next step: <strong>{choices[0]}</strong>
        </p>
      )}
    </aside>
  );
}
