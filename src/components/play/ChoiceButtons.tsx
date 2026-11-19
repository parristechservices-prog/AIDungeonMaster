type Props = {
  choices?: string[];
  busy: boolean;
  onPick: (choice: string) => void;
};

export function ChoiceButtons({ choices, busy, onPick }: Props) {
  if (!choices || choices.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 [@media(max-height:500px)]:hidden">Suggested actions</p>
      {/* Phones: one swipeable row of finger-sized buttons, so they don't eat the story's space. */}
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            disabled={busy}
            onClick={() => onPick(choice)}
            className="shrink-0 whitespace-nowrap rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm hover:bg-zinc-100 disabled:opacity-50 md:shrink md:whitespace-normal md:px-3 md:py-1.5 md:text-xs [@media(pointer:coarse)]:min-h-[44px] dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            {choice}
          </button>
        ))}
      </div>
    </div>
  );
}
