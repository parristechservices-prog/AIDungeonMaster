import Link from 'next/link';
import { FEATURE_FLAGS } from '@/lib/config/features';

const ROADMAP = [
  { label: 'Voice DM (STT/TTS)', enabled: FEATURE_FLAGS.voiceInput },
  { label: 'Multiplayer rooms', enabled: FEATURE_FLAGS.multiplayerRooms },
  { label: 'Accounts & cloud save', enabled: FEATURE_FLAGS.cloudSave },
  { label: 'Appeal the DM', enabled: FEATURE_FLAGS.appealTheDm },
] as const;

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">PartyQuest V0</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">AI Dungeon Master</h1>
      <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
        A solo fantasy one-shot where a <strong>deterministic rules engine</strong> owns the numbers and an{' '}
        <strong>AI narrator</strong> owns the story. Choose your class, background, and starting scenario.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          className="rounded-lg bg-black px-5 py-3 font-medium text-white dark:bg-zinc-100 dark:text-black"
          href="/start"
        >
          Create adventure
        </Link>
        <Link
          className="rounded-lg border border-zinc-300 px-5 py-3 text-sm dark:border-zinc-600"
          href="/start?adventureId=tutorial"
        >
          Play tutorial
        </Link>
        <Link
          className="rounded-lg border border-zinc-300 px-5 py-3 text-sm dark:border-zinc-600"
          href="/play"
        >
          Continue last session
        </Link>
        <a
          className="rounded-lg border border-zinc-300 px-5 py-3 text-sm dark:border-zinc-600"
          href="https://github.com/parristechservices-prog/AIDungeonMaster"
          target="_blank"
          rel="noopener noreferrer"
        >
          View on GitHub
        </a>
      </div>

      <section className="mt-12 grid gap-6 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="font-semibold">Fair mechanics</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            HP, dice, and combat flow through the engine — the AI never invents stats.
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="font-semibold">Rich narration</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Groq or OpenAI when configured; reliable table-rules fallback offline.
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="font-semibold">Canon memory</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Facts you establish are logged and fed back into every DM turn.
          </p>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Coming next</h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          {ROADMAP.map((item) => (
            <li key={item.label} className="flex items-center gap-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${item.enabled ? 'bg-green-500' : 'bg-zinc-400'}`}
                aria-hidden
              />
              {item.label}
              {!item.enabled && <span className="text-xs text-zinc-400">(planned)</span>}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-12 text-xs text-zinc-500">
        Need API keys? Copy <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">env.example</code> to{' '}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">.env.local</code> and run{' '}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">pnpm dev</code>.
      </p>
    </main>
  );
}
