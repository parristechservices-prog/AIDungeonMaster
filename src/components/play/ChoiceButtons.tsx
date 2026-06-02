type Props = {
  choices: string[];
  busy: boolean;
  onPick: (choice: string) => void;
};

export function ChoiceButtons({ choices, busy, onPick }: Props) {
  if (choices.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Suggested actions</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            disabled={busy}
            onClick={() => onPick(choice)}
            className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            {choice}
          </button>
        ))}
      </div>
    </div>
  );
}
