'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { adventureModuleSchema, type AdventureModuleFile } from '@/lib/game/adventures/module-schema';

type SceneDraft = {
  id: string;
  kind: 'social' | 'exploration' | 'combat';
  goal: string;
  starter: string;
  choices: string;
  guidance: string;
};

const defaultScenes: SceneDraft[] = [
  {
    id: 'opening',
    kind: 'social',
    goal: 'Find out what happened here.',
    starter: 'Lantern light spills across a nervous room as the first witness looks up.',
    choices: 'Ask the witness, Study the room, Step outside',
    guidance: 'Let the player talk, observe, leave, or push on any plausible lead.',
  },
  {
    id: 'trail',
    kind: 'exploration',
    goal: 'Follow the strongest lead.',
    starter: 'Outside, rain and old tracks point toward a darker place ahead.',
    choices: 'Follow the tracks, Search for clues, Return to question someone',
    guidance: 'Reward specific investigation and allow backtracking.',
  },
  {
    id: 'ambush',
    kind: 'combat',
    goal: 'Survive the ambush.',
    starter: 'A shape breaks from cover and the quiet turns sharp.',
    choices: 'Attack, Take cover, Try to negotiate',
    guidance: 'Run combat through the engine and let nonviolent ideas matter when plausible.',
  },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'custom-adventure';
}

function splitList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function buildModule(title: string, tagline: string, scenes: SceneDraft[]): AdventureModuleFile {
  const id = slugify(title);
  const socialScene = scenes.find((scene) => scene.kind === 'social') ?? scenes[0];
  const explorationScene = scenes.find((scene) => scene.kind === 'exploration') ?? scenes[0];

  return {
    id,
    title,
    tagline,
    estimatedMinutes: 45,
    tone: 'cinematic fantasy',
    recommendedCharacters: ['fighter', 'rogue', 'wizard', 'cleric'],
    levelRange: [1, 5],
    sourceNote: 'Created in the PartyQuest adventure builder. Add only original notes or content you own.',
    playConfig: {
      defaultLevel: 3,
      partySize: 1,
      defaultDifficulty: 'medium',
      spawnMonstersOnCombatOnly: true,
      preferredMonsterTemplates: ['goblin', 'orc', 'hobgoblin'],
    },
    sceneOrder: [...scenes.map((scene) => scene.id), 'ending'],
    scenes: Object.fromEntries(
      scenes.map((scene) => [
        scene.id,
        {
          kind: scene.kind,
          goal: scene.goal,
          starter: scene.starter,
          choices: splitList(scene.choices),
          guidance: scene.guidance,
          allowedNpcs: scene.kind === 'social' ? ['guide'] : [],
          allowedMonsters: scene.kind === 'combat' ? ['raider'] : [],
          allowedExits: ['backtrack', 'press-on', 'leave'],
          forbidden: ['Do not force the player to follow only the suggested choices.'],
          successConditions: ['The player establishes a clear next step.'],
        },
      ]),
    ),
    endingMessage: 'The immediate danger passes, but the choices made here will echo into the next session.',
    npcs: [
      {
        id: 'guide',
        name: 'Local Guide',
        description: socialScene.starter,
        disposition: 'neutral',
        knowledge: [socialScene.goal, explorationScene.goal],
      },
    ],
    monsters: [
      {
        id: 'raider',
        name: 'Road Raider',
        ac: 13,
        maxHp: 11,
        attackBonus: 4,
        damage: '1d6+2',
      },
    ],
    mock: {
      socialNpcId: 'guide',
      socialNpcName: 'Local Guide',
      socialSuccess: 'The guide shares the missing piece and points you toward the next lead.',
      socialFailure: 'The guide hesitates, but there are still other ways to learn what happened.',
      explorationSuccess: 'You find a strong sign and know exactly where the trail leads.',
      explorationFailure: 'The clue is muddy, but you can try another angle or follow the risky route.',
      socialSkill: 'persuasion',
      explorationSkill: 'investigation',
      socialDc: 12,
      explorationDc: 13,
      canonFactOnSocialSuccess: `${socialScene.goal} is tied to ${explorationScene.goal}`,
    },
  };
}

export default function BuilderPage() {
  const [title, setTitle] = useState('The Hollow Road');
  const [tagline, setTagline] = useState('A short mystery with one social lead, one trail, and one dangerous turn.');
  const [scenes, setScenes] = useState(defaultScenes);

  const moduleDraft = useMemo(() => buildModule(title, tagline, scenes), [title, tagline, scenes]);
  const validation = adventureModuleSchema.safeParse(moduleDraft);
  const json = JSON.stringify(moduleDraft, null, 2);

  function updateScene(index: number, updates: Partial<SceneDraft>) {
    setScenes((current) => current.map((scene, i) => (i === index ? { ...scene, ...updates } : scene)));
  }

  function addScene() {
    setScenes((current) => [
      ...current,
      {
        id: `scene-${current.length + 1}`,
        kind: 'exploration',
        goal: 'Explore the new lead.',
        starter: 'A new place opens ahead.',
        choices: 'Look around, Move carefully, Ask a question',
        guidance: 'Let the player choose their route and only call for rolls when failure is interesting.',
      },
    ]);
  }

  function downloadJson() {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${moduleDraft.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">Back home</Link>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">Adventure Builder</p>
          <h1 className="mt-1 text-3xl font-bold">Build a playable module draft</h1>
        </div>
        <button
          type="button"
          onClick={downloadJson}
          disabled={!validation.success}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950"
        >
          Download JSON
        </button>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_440px]">
        <section className="space-y-6">
          <div className="grid gap-3 rounded border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-medium">Title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
            </label>
            <label className="text-sm">
              <span className="font-medium">Tagline</span>
              <input value={tagline} onChange={(event) => setTagline(event.target.value)} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
            </label>
          </div>

          {scenes.map((scene, index) => (
            <div key={scene.id} className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">Scene {index + 1}</h2>
                <select value={scene.kind} onChange={(event) => updateScene(index, { kind: event.target.value as SceneDraft['kind'] })} className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <option value="social">Social</option>
                  <option value="exploration">Exploration</option>
                  <option value="combat">Combat</option>
                </select>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="font-medium">Scene ID</span>
                  <input value={scene.id} onChange={(event) => updateScene(index, { id: slugify(event.target.value) })} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
                </label>
                <label className="text-sm">
                  <span className="font-medium">Goal</span>
                  <input value={scene.goal} onChange={(event) => updateScene(index, { goal: event.target.value })} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
                </label>
              </div>
              <label className="mt-3 block text-sm">
                <span className="font-medium">Opening narration</span>
                <textarea value={scene.starter} onChange={(event) => updateScene(index, { starter: event.target.value })} rows={2} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
              </label>
              <label className="mt-3 block text-sm">
                <span className="font-medium">Suggested choices, comma-separated</span>
                <input value={scene.choices} onChange={(event) => updateScene(index, { choices: event.target.value })} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
              </label>
              <label className="mt-3 block text-sm">
                <span className="font-medium">DM guidance</span>
                <textarea value={scene.guidance} onChange={(event) => updateScene(index, { guidance: event.target.value })} rows={3} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900" />
              </label>
            </div>
          ))}

          <button type="button" onClick={addScene} className="rounded border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-700">
            Add scene
          </button>
        </section>

        <aside className="rounded border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Module JSON</h2>
            <span className={`rounded px-2 py-1 text-xs font-semibold ${validation.success ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'}`}>
              {validation.success ? 'Valid' : 'Needs fixes'}
            </span>
          </div>
          {!validation.success && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-300">
              {validation.error.issues[0]?.message ?? 'Module draft is invalid.'}
            </p>
          )}
          <pre className="mt-3 max-h-[720px] overflow-auto rounded bg-white p-3 text-[11px] text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {json}
          </pre>
        </aside>
      </div>
    </main>
  );
}
