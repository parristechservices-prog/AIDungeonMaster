type Props = {
  failedResult?: { kind: string; summary: string; ok: boolean };
  choices: string[];
  onUseSuggestion?: (suggestion: string) => void;
};

export function FailedCheckRecovery({ failedResult, choices, onUseSuggestion }: Props) {
  if (!failedResult || failedResult.ok || failedResult.kind !== 'skill_check') return null;

  const suggestions = choices.slice(0, 3);

  return (
    <aside
      className="mt-3 rounded border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100"
      aria-label="Failed check recovery"
      role="status"
      aria-live="polite"
    >
      <p className="font-semibold">That approach did not work, but the scene is still open.</p>
      <p className="mt-2 text-xs opacity-80">
        {failedResult.summary}
      </p>
      <p className="mt-3 text-xs opacity-90">
        Try a different action or pick one of the suggestions below.
      </p>

      {suggestions.length > 0 ? (
        <div className="mt-3 space-y-2">
          {suggestions.map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => onUseSuggestion?.(choice)}
              className="w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-left text-sm text-blue-950 transition hover:border-blue-300 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/80 dark:text-blue-100 dark:hover:bg-blue-900"
            >
              {choice}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs opacity-80">No suggested recovery actions are available right now.</p>
      )}
    </aside>
  );
}
