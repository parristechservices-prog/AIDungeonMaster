'use client';

import { useState, useEffect } from 'react';

type TurnResponse = {
  ok: boolean;
  sessionId: string;
  mode: 'ai_director' | 'table_rules';
  sceneId: string;
  sceneGoal: string;
  sceneStarter?: string;
  nextChoices: string[];
  nextHook: string;
  narration: string;
  engineResults: { kind: string; summary: string; ok: boolean }[];
  state: {
    player: { 
      name: string; 
      hp: number; 
      maxHp: number; 
      ac: number; 
      features: { id: string; name: string; usesRemaining: number }[];
      spellSlots: Record<number, { max: number; remaining: number }>;
      gold: number;
      inventory: string[];
    };
    monsters: { id: string; name: string; hp: number; maxHp: number; ac: number }[];
    npcs: { id: string; name: string; disposition: string; description: string }[];
    canonLog: { id: string; content: string }[];
    log: string[];
  };
  recap: { turnNumber: number };
};

export default function PlayPage() {
  const [sessionId, setSessionId] = useState('');
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>(['Welcome to PartyQuest.']);
  const [state, setState] = useState<TurnResponse['state'] | null>(null);
  const [sceneId, setSceneId] = useState('social');
  const [sceneGoal, setSceneGoal] = useState('Learn where the missing courier went.');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'ai_director' | 'table_rules'>('table_rules');
  const [choices, setChoices] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('partyquest-session-id');
      if (saved) {
        setSessionId(saved);
      } else {
        const next = `sess-${crypto.randomUUID().slice(0, 8)}`;
        setSessionId(next);
        localStorage.setItem('partyquest-session-id', next);
      }
    } catch (e) {
      // Fallback for restricted environments
      setSessionId(`sess-${crypto.randomUUID().slice(0, 8)}`);
    }
  }, []);

  async function sendTurn() {
    if (!input.trim() || busy) return;
    const nextInput = input;
    setInput('');
    setBusy(true);
    setHistory((h) => [...h, `> ${nextInput}`]);

    try {
      const res = await fetch('/api/turn', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, playerInput: nextInput }),
      });
      const data = (await res.json()) as TurnResponse;
      if (!data.ok) throw new Error('Turn failed');

      setSceneId(data.sceneId);
      setSceneGoal(data.sceneGoal);
      setMode(data.mode);
      setChoices(data.nextChoices);

      // If state is available, update it
      if (data.state) {
        setState(data.state);
      }

      const lines = [
        ...(data.sceneStarter ? [`Scene shift: ${data.sceneStarter}`] : []),
        data.narration,
        ...data.engineResults.map((r) => `• ${r.summary}`),
        `Recap saved (turn ${data.recap.turnNumber}).`,
        data.nextHook,
      ];
      setHistory((h) => [...h, ...lines]);
    } catch {
      setHistory((h) => [...h, 'The guide pauses, then resumes. Try that action again.']);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 p-6 md:grid-cols-[2fr_1fr]">
      <section className="rounded border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <h1 className="text-2xl font-bold">PartyQuest — V0 Playtest</h1>
        <p className="mt-1 text-sm text-zinc-600">Scene: <b>{sceneId}</b> · Goal: {sceneGoal}</p>
        <p className="mt-1 text-xs text-zinc-500">Mode: {mode === 'ai_director' ? 'AI Director' : 'Table Rules'}</p>

        <div className="mt-4 h-[430px] overflow-y-auto rounded border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-950">
          {history.map((line, i) => <p key={`${line}-${i}`} className="mb-2 whitespace-pre-wrap">{line}</p>)}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendTurn()}
            className="flex-1 rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="Try: I ask Mira about the courier / I attack"
          />
          <button onClick={sendTurn} disabled={busy} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
            {busy ? '...' : 'Send'}
          </button>
        </div>
        {choices.length > 0 && (
          <div className="mt-3 text-xs text-zinc-600">
            <p className="font-semibold">Suggested actions</p>
            <ul className="ml-4 list-disc">
              {choices.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </div>
        )}
      </section>

      <aside className="rounded border border-zinc-300 bg-white p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="font-semibold">Character</h2>
        {!state ? <p className="mt-2 text-zinc-600">No turn yet.</p> : (
          <>
            <p className="mt-2">{state.player.name}</p>
            <p>HP: {state.player.hp}/{state.player.maxHp}</p>
            <p>AC: {state.player.ac}</p>
            <p>Gold: {state.player.gold}gp</p>
            
            <p className="mt-2 font-semibold">Inventory</p>
            <div className="max-h-32 overflow-y-auto text-xs">
              {state.player.inventory.length > 0 ? (
                <ul className="list-inside list-disc">
                  {state.player.inventory.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              ) : <p className="text-zinc-500 italic">Empty.</p>}
            </div>
            
            <p className="mt-2 font-semibold">Features</p>
            {state.player.features.map((f) => <p key={f.id}>{f.name}: {f.usesRemaining} use(s)</p>)}
            
            {Object.keys(state.player.spellSlots).length > 0 && (
              <>
                <p className="mt-2 font-semibold">Spell Slots</p>
                {Object.entries(state.player.spellSlots).map(([lvl, s]) => (
                  <p key={lvl}>Level {lvl}: {s.remaining}/{s.max}</p>
                ))}
              </>
            )}

            <p className="mt-3 font-semibold">Enemies</p>
            {state.monsters.length > 0 ? state.monsters.map((m) => (
              <p key={m.id}>{m.name}: {m.hp}/{m.maxHp} HP</p>
            )) : <p className="text-zinc-500 italic">None visible.</p>}

            <p className="mt-3 font-semibold">NPCs</p>
            {state.npcs.length > 0 ? state.npcs.map((n) => (
              <p key={n.id} title={n.description}>{n.name} ({n.disposition})</p>
            )) : <p className="text-zinc-500 italic">None nearby.</p>}

            <p className="mt-3 font-semibold">Canon Facts</p>
            <div className="max-h-40 overflow-y-auto">
              {state.canonLog.length > 0 ? state.canonLog.map((f, i) => (
                <p key={`${f.id}-${i}`} className="mb-1 text-xs">• {f.content}</p>
              )) : <p className="text-zinc-500 italic">No facts established.</p>}
            </div>
          </>
        )}
      </aside>
    </main>
  );
}
