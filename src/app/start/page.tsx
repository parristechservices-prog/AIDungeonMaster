'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { FormEvent } from 'react';
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
    source?: 'builtin' | 'private' | 'template';
    levelRange?: [number, number];
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
  
  // Multiplayer party state
  const [party, setParty] = useState<Array<{ characterId: string; playerName: string }>>([
    { characterId: 'fighter', playerName: '' }
  ]);
  
  const [adventureId, setAdventureId] = useState('brindlehook-inn');
  const [backgroundId, setBackgroundId] = useState<string>('');
  const [personaId, setPersonaId] = useState('balanced');
  const [playerLevel, setPlayerLevel] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState('');
  const [importMessage, setImportMessage] = useState('');

  async function loadCatalog() {
    const res = await fetch('/api/catalog');
    const data = await res.json();
    if (!data.ok) throw new Error('Could not load options');
    setCatalog(data);
  }

  useEffect(() => {
    loadCatalog().catch(() => setError('Could not load options.'));
  }, []);

  useEffect(() => {
    const fromQuery = searchParams.get('adventureId');
    if (!fromQuery) return;
    setAdventureId(fromQuery);
  }, [searchParams]);

  useEffect(() => {
    const scenario = catalog?.scenarios.find((s) => s.id === adventureId);
    if (scenario?.levelRange) {
      setPlayerLevel(scenario.levelRange[0]);
    }
  }, [adventureId, catalog]);

  const selectedScenario = catalog?.scenarios.find((s) => s.id === adventureId);

  function addPlayer() {
    if (party.length >= 4) return;
    setParty([...party, { characterId: 'fighter', playerName: '' }]);
  }

  function removePlayer(index: number) {
    if (party.length <= 1) return;
    setParty(party.filter((_, i) => i !== index));
  }

  function updatePlayer(index: number, updates: Partial<{ characterId: string; playerName: string }>) {
    setParty(party.map((p, i) => i === index ? { ...p, ...updates } : p));
  }

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
          characterIds: party.map(p => p.characterId),
          playerNames: party.map(p => p.playerName.trim() || undefined),
          playerLevel,
          backgroundId: backgroundId || undefined,
          personaId,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error('Failed to start');

      sessionStorage.setItem(
        'partyquest-opening',
        JSON.stringify({
          opening: data.opening,
          title: data.title,
          adventureId: data.adventureId,
          sceneId: data.sceneId,
          sceneGoal: data.sceneGoal,
          nextChoices: data.nextChoices,
          state: data.state,
        }),
      );
      router.push('/play');
    } catch {
      setError('Could not start adventure. Try again.');
      setBusy(false);
    }
  }

  async function importLocalModule(formData: FormData) {
    setImportBusy(true);
    setImportError('');
    setImportMessage('');
    try {
      const file = formData.get('file');
      if (!(file instanceof File) || !file.size) {
        throw new Error('Select a module JSON file first.');
      }

      const moduleId = String(formData.get('moduleId') || '').trim();
      const upload = new FormData();
      upload.append('file', file);
      if (moduleId) {
        upload.append('moduleId', moduleId);
      }

      const res = await fetch('/api/modules/import', {
        method: 'POST',
        body: upload,
      });
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Could not import module.');
      }

      setImportMessage(`Imported ${data.id} to ${data.path}`);
      await loadCatalog();
      setAdventureId(data.id);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not import module.');
    } finally {
      setImportBusy(false);
    }
  }

  async function handleImportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await importLocalModule(formData);
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
        Pick your heroes, optional background, and starting scenario. You can play solo or with a party of up to 4.
      </p>

      <section className="mt-8">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">1. The Party</h2>
          {party.length < 4 && (
            <button 
              onClick={addPlayer}
              className="text-xs font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded hover:bg-zinc-200"
            >
              + Add Player
            </button>
          )}
        </div>
        
        <div className="mt-4 space-y-8">
          {party.map((p, idx) => (
            <div key={idx} className="relative p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Player {idx + 1}</h3>
                {party.length > 1 && (
                  <button onClick={() => removePlayer(idx)} className="text-xs text-red-500 hover:underline">Remove</button>
                )}
              </div>
              
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {catalog.characters.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => updatePlayer(idx, { characterId: c.id })}
                    className={`rounded-lg border p-3 text-left text-xs transition ${
                      p.characterId === c.id
                        ? 'border-black bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800'
                        : 'border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    <p className="font-semibold">{c.label}</p>
                    <p className="mt-1 text-zinc-500 line-clamp-2">{c.description}</p>
                  </button>
                ))}
              </div>
              
              <label className="mt-4 block text-sm">
                <span className="font-medium">Hero name</span>
                <input
                  value={p.playerName}
                  onChange={(e) => updatePlayer(idx, { playerName: e.target.value })}
                  placeholder={catalog.characters.find(c => c.id === p.characterId)?.label ?? 'Name'}
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
                  maxLength={40}
                />
              </label>
            </div>
          ))}
        </div>

        {selectedScenario?.levelRange && (
          <label className="mt-8 block text-sm">
            <span className="font-medium">
              Party Level ({selectedScenario.levelRange[0]}–{selectedScenario.levelRange[1]})
            </span>
            <input
              type="range"
              min={selectedScenario.levelRange[0]}
              max={selectedScenario.levelRange[1]}
              value={playerLevel}
              onChange={(e) => setPlayerLevel(Number(e.target.value))}
              className="mt-2 w-full"
            />
            <span className="text-zinc-500">Level {playerLevel}</span>
          </label>
        )}
      </section>

      <section className="mt-12">
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

      <section className="mt-12">
        <h2 className="text-lg font-semibold">3. Scenario</h2>
        <div className="mt-3 space-y-2">
          {catalog.scenarios.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setAdventureId(s.id)}
              className={`flex w-full items-start gap-4 rounded-lg border p-4 text-left transition ${
                adventureId === s.id
                  ? 'border-black bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800'
                  : 'border-zinc-200 dark:border-zinc-700'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{s.title}</p>
                  {s.source === 'private' && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      Private
                    </span>
                  )}
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{s.tagline}</p>
                <div className="mt-2 flex gap-3 text-[11px] text-zinc-500">
                  <span>{s.estimatedMinutes} min</span>
                  <span>•</span>
                  <span className="capitalize">{s.tone}</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Import Custom Module</p>
          <form onSubmit={handleImportSubmit} className="mt-2 flex flex-col gap-2">
            <input
              type="file"
              name="file"
              accept=".json"
              className="text-xs text-zinc-500 file:mr-4 file:rounded file:border-0 file:bg-zinc-100 file:px-4 file:py-1 file:text-xs file:font-semibold hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-300"
            />
            <div className="flex gap-2">
              <input
                name="moduleId"
                placeholder="Module ID (optional)"
                className="flex-1 rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-900"
              />
              <button
                type="submit"
                disabled={importBusy}
                className="rounded bg-zinc-900 px-3 py-1 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {importBusy ? 'Importing...' : 'Import'}
              </button>
            </div>
            {importError && <p className="text-[10px] text-red-500">{importError}</p>}
            {importMessage && <p className="text-[10px] text-green-600">{importMessage}</p>}
          </form>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">4. DM Persona</h2>
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

      <div className="mt-16 flex flex-col items-center gap-4">
        <button
          onClick={beginAdventure}
          disabled={busy || party.length === 0}
          className="w-full max-w-sm rounded-full bg-zinc-900 py-4 text-center font-bold text-white transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy ? 'Preparing Adventure…' : 'Begin Quest'}
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </main>
  );
}
