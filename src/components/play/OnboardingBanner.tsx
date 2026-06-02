type Props = {
  sceneId: string;
  onDismiss: () => void;
};

const HINTS: Record<string, string> = {
  social:
    'You arrive at Brindlehook Inn in the rain. Try greeting Mira or asking about the missing courier.',
  exploration:
    'Follow tracks toward the boathouse. Search for clues or call out to flush an ambush.',
  combat:
    'Initiative is live. Attack a ruffian, use Second Wind, or describe a tactical move.',
  ending: 'Your tale concludes here.',
};

const STARTERS = [
  'I greet Mira and ask about the courier',
  'I offer coin for information',
  'I look around the inn',
];

export function OnboardingBanner({ sceneId, onDismiss }: Props) {
  return (
    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm dark:border-blue-900 dark:bg-blue-950/40">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-blue-900 dark:text-blue-100">How to play</p>
          <p className="mt-1 text-blue-800 dark:text-blue-200">{HINTS[sceneId] ?? HINTS.social}</p>
          {sceneId === 'social' && (
            <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">
              Starters: {STARTERS.map((s) => `"${s}"`).join(' · ')}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-xs text-blue-700 underline dark:text-blue-300"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
