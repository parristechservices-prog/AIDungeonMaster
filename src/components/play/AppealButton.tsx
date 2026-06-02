type Props = {
  busy: boolean;
  onAppeal: () => void;
};

export function AppealButton({ busy, onAppeal }: Props) {
  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={busy}
        onClick={onAppeal}
        className="text-xs text-zinc-600 underline hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-200"
        title="Question a ruling or ask the DM to reconsider — sends [APPEAL] to the narrator"
      >
        Appeal the DM
      </button>
    </div>
  );
}
