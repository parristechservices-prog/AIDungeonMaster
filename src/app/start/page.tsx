'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { clearClientSnapshot } from '@/lib/persistence/client-snapshot';
import { newSessionId } from '@/lib/play/bootstrap';

type Catalog = {
  characters: Array<{
    id: string;
    label: string;
    className: string;
    description: string;
    suggestedAdventures: string[];
  }>;
  backgrounds: Array<{ id: string; label: string; description: string }>;
  scenarios: Array<{
    id: string;
    title: string;
    tagline: string;
    estimatedMinutes: number;
    tone: string;
    recommendedCharacters: string[];
  }>;
  personas: Array<{ id: string; name: string; description: string }>;
};

export default function StartPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-2xl p-6"><p className="text-zinc-600">Loading...</p></main>}>
      <StartContent />
    </Suspense>
  );
}

function StartContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [characterId, setCharacterId] = useState('fighter');
  
  const initialAdventureId = searchParams.get('adventureId') || 'brindlehook-inn';
  const [adventureId, setAdventureId] = useState(initialAdventureId);
  const [backgroundId, setBackgroundId] = useState<string>('');
  const [personaId, setPersonaId] = useState('balanced');
  const [playerName, setPlayerName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/catalog')
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setCatalog(data);
      })
      .catch(() => setError('Could not load options.'));
  }, []);

  const selectedCharacter = catalog?.characters.find((c) => c.id === characterId);
  const selectedScenario = catalog?.scenarios.find((s) => s.id === adventureId);

  async function beginAdventure() {
    setBusy(true);
    setError('');
    try {
      const sessionId = newSessionId();
      localStorage.setItem('partyquest-session-id', sessionId);
      clearClientSnapshot();

      const res = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          adventureId,
          characterId,
          playerName: playerName.trim() || undefined,
          backgroundId: backgroundId || undefined,
          personaId,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error('Failed to start');

      sessionStorage.setItem(
        'partyquest-opening',
        JSON.stringify({ opening: data.opening, title: data.title }),
      );
      router.push('/play');
    } catch {
      setError('Could not start adventure. Try again.');
      setBusy(false);
    }
  }

  if (!catalog) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-zinc-600">{error || 'Loading options…'}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← Home
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Create your run</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Pick a hero, optional background, and starting scenario. Each run is a ~30 minute solo adventure.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">1. Character</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {catalog.characters.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCharacterId(c.id)}
              className={`rounded-lg border p-4 text-left text-sm transition ${
                characterId === c.id
                  ? 'border-black bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800'
                  : 'border-zinc-200 dark:border-zinc-700'
              }`}
            >
              <p className="font-semibold">{c.label}</p>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">{c.description}</p>
            </button>
          ))}
        </div>
        <label className="mt-4 block text-sm">
          <span className="font-medium">Hero name</span> (optional)
          <input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder={selectedCharacter?.label ?? 'Your name'}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
            maxLength={40}
          />
        </label>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">2. Background</h2>
        <p className="mt-1 text-sm text-zinc-500">Optional — adds a canon fact at the start.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setBackgroundId('')}
            className={`rounded-lg border p-3 text-left text-sm ${
              !backgroundId ? 'border-black dark:border-zinc-100' : 'border-zinc-200 dark:border-zinc-700'
            }`}
          >
            <p className="font-medium">None</p>
            <p className="text-zinc-500">Jump straight into the action.</p>
          </button>
          {catalog.backgrounds.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBackgroundId(b.id)}
              className={`rounded-lg border p-3 text-left text-sm ${
                backgroundId === b.id
                  ? 'border-black dark:border-zinc-100'
                  : 'border-zinc-200 dark:border-zinc-700'
              }`}
            >
              <p className="font-medium">{b.label}</p>
              <p className="text-zinc-500">{b.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">3. DM persona</h2>
        <p className="mt-1 text-sm text-zinc-500">How should the narrator tell your story?</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {catalog.personas.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPersonaId(p.id)}
              className={`rounded-lg border p-3 text-left text-sm ${
                personaId === p.id
                  ? 'border-black dark:border-zinc-100'
                  : 'border-zinc-200 dark:border-zinc-700'
              }`}
            >
              <p className="font-medium">{p.name}</p>
              <p className="text-zinc-500">{p.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">4. Starting scenario</h2>
        <div className="mt-3 space-y-3">
          {catalog.scenarios.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setAdventureId(s.id)}
              className={`w-full rounded-lg border p-4 text-left ${
                adventureId === s.id
                  ? 'border-black bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800'
                  : 'border-zinc-200 dark:border-zinc-700'
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{s.title}</p>
                <span className="text-xs text-zinc-500">
                  ~{s.estimatedMinutes} min · {s.tone}
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{s.tagline}</p>
              {s.recommendedCharacters.includes(characterId) && (
                <p className="mt-2 text-xs text-green-700 dark:text-green-400">Recommended for your class</p>
              )}
            </button>
          ))}
        </div>
      </section>

      {selectedScenario && selectedCharacter && (
        <p className="mt-8 rounded-lg bg-zinc-100 p-4 text-sm dark:bg-zinc-800">
          You will play <strong>{playerName.trim() || selectedCharacter.label}</strong> (
          {selectedCharacter.className}) in <em>{selectedScenario.title}</em>.
        </p>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        disabled={busy}
        onClick={beginAdventure}
        className="mt-6 w-full rounded-lg bg-black py-3 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-black sm:w-auto sm:px-8"
      >
        {busy ? 'Preparing…' : 'Begin adventure'}
      </button>
    </main>
  );
}
