'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { CharacterSheet } from '@/components/play/CharacterSheet';
import { ChoiceButtons } from '@/components/play/ChoiceButtons';
import { CombatHUD } from '@/components/play/CombatHUD';
import { DiceResults } from '@/components/play/DiceResults';
import { EndingScreen } from '@/components/play/EndingScreen';
import { InputBox } from '@/components/play/InputBox';
import { NarrationPanel } from '@/components/play/NarrationPanel';
import { OnboardingBanner } from '@/components/play/OnboardingBanner';
import { AppealButton } from '@/components/play/AppealButton';
import { AmbientAudio } from '@/components/play/AmbientAudio';
import { ManualRollModal } from '@/components/play/ManualRollModal';
import { isFeatureEnabled } from '@/lib/config/features';
import { DEFAULT_ADVENTURE_ID, getAdventure, getFirstPlayableSceneId, getSceneGoal } from '@/lib/game/adventures';
import type { TurnResponse } from '@/lib/play/types';
import { saveClientSnapshot } from '@/lib/persistence/client-snapshot';
import type { RollBreakdown } from '@/lib/engine/types';
import { readPlayBootstrap } from '@/lib/play/bootstrap';

export default function PlayPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState('');
  const [adventureId, setAdventureId] = useState(DEFAULT_ADVENTURE_ID);
  const [adventureTitle, setAdventureTitle] = useState(getAdventure(DEFAULT_ADVENTURE_ID).title);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [state, setState] = useState<TurnResponse['state'] | null>(null);
  const [sceneId, setSceneId] = useState<TurnResponse['sceneId']>('social');
  const [sceneGoal, setSceneGoal] = useState(
    getSceneGoal(getAdventure(DEFAULT_ADVENTURE_ID), getFirstPlayableSceneId(getAdventure(DEFAULT_ADVENTURE_ID))),
  );
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'ai_director' | 'table_rules'>('table_rules');
  const [choices, setChoices] = useState<string[]>([]);
  const [recentRolls, setRecentRolls] = useState<RollBreakdown[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [turnCount, setTurnCount] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [ambient, setAmbient] = useState<TurnResponse['ambient']>('none');
  const [physicalDice, setPhysicalDice] = useState(false);
  const [manualRollContext, setManualRollContext] = useState<TurnResponse['manualRollContext'] | null>(null);

  async function hydrateSession(nextSessionId: string) {
    const res = await fetch(`/api/session?sessionId=${encodeURIComponent(nextSessionId)}`);
    const data = await res.json();
    if (!data.ok || !data.state) return;

    setAdventureId(data.adventureId);
    setAdventureTitle(data.adventureTitle);
    setSceneId(data.sceneId);
    setSceneGoal(data.sceneGoal);
    setChoices(data.nextChoices ?? []);
    setMode(data.mode ?? 'table_rules');
    setState(data.state);
  }

  const handleExportRecap = useCallback(() => {
    if (!state) return;

    const party = state.party ?? [];
    const canonLog = state.canonLog ?? [];
    const markdown = [
      `# Adventure Recap: ${adventureTitle}`,
      `**Party:** ${party.map(p => `${p.name} (${p.race} ${p.className})`).join(', ')}`,
      `**Session ID:** ${sessionId}`,
      '',
      '## The Journey So Far',
      history.join('\n\n'),
      '',
      '## Party Status',
      ...party.map(p => [
        `### ${p.name}`,
        `- **HP:** ${p.hp}/${p.maxHp}`,
        `- **AC:** ${p.ac}`,
        `- **Gold:** ${p.gold}gp`,
        `- **Inventory:** ${p.inventory.join(', ') || 'None'}`,
      ].join('\n')),
      '',
      '## Canon Log (Key Facts)',
      canonLog.map(f => `- [${f.importance.toUpperCase()}] ${f.content}`).join('\n'),
    ].join('\n');

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recap-${sessionId}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [state, adventureTitle, sessionId, history]);

  useEffect(() => {
    const boot = readPlayBootstrap();
    setSessionId(boot.sessionId);

    const openingRaw = sessionStorage.getItem('partyquest-opening');
    if (openingRaw) {
      try {
        const { opening, title, adventureId: openingAdventureId, state: openingState, sceneId: openingSceneId, sceneGoal: openingSceneGoal, nextChoices } = JSON.parse(openingRaw) as {
          opening: string;
          title: string;
          adventureId?: string;
          state?: TurnResponse['state'];
          sceneId?: TurnResponse['sceneId'];
          sceneGoal?: string;
          nextChoices?: string[];
        };
        sessionStorage.removeItem('partyquest-opening');
        setAdventureTitle(title);
        setHistory([opening]);
        if (openingAdventureId) setAdventureId(openingAdventureId);
        if (openingState) setState(openingState);
        if (openingSceneId) setSceneId(openingSceneId);
        if (openingSceneGoal) setSceneGoal(openingSceneGoal);
        if (nextChoices) setChoices(nextChoices);
      } catch {
        setHistory(boot.history);
      }
    } else {
      setHistory(boot.history);
    }

    if (boot.state) {
      setState(boot.state);
      setSceneId(boot.sceneId);
      setSceneGoal(boot.sceneGoal);
      setMode(boot.mode);
      setChoices(boot.choices);
      setAmbient(boot.ambient ?? 'none');
    }
    if (boot.adventureId) {
      setAdventureId(boot.adventureId);
      setAdventureTitle(boot.adventureTitle ?? getAdventure(boot.adventureId).title);
      setSceneGoal(boot.sceneGoal);
    }
    if (!boot.state && boot.sessionId) {
      hydrateSession(boot.sessionId).catch(() => {
        // Keep local bootstrap fallback if reconnect state is unavailable.
      });
    }
  }, []);

  const sendTurn = useCallback(
    async (rawInput: string, manualRoll?: number) => {
      const nextInput = rawInput.trim();
      if (!nextInput && manualRoll === undefined) return;
      if (busy || !sessionId) return;

      if (manualRoll === undefined) {
        setInput('');
        setHistory((h) => [...h, `> ${nextInput}`]);
      }
      setBusy(true);

      try {
        const res = await fetch('/api/turn', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ 
            sessionId, 
            playerInput: nextInput, 
            physicalDice,
            manualRoll
          }),
        });
        const contentType = res.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) {
          throw new Error('Non-JSON turn response');
        }
        const data = (await res.json()) as TurnResponse;
        if (!data.ok) throw new Error('Turn failed');

        setAdventureId(data.adventureId);
        setAdventureTitle(data.adventureTitle);
        setSceneId(data.sceneId);
        setSceneGoal(data.sceneGoal);
        setMode(data.mode);
        setChoices(data.nextChoices ?? []);
        setRecentRolls(data.recentRolls ?? []);
        setWarnings(data.narrationWarnings ?? []);
        setAmbient(data.ambient ?? 'none');
        setTurnCount((n) => n + 1);
        if (data.state) setState(data.state);

        if (data.needsManualRoll && data.manualRollContext) {
          setManualRollContext(data.manualRollContext);
        } else {
          setManualRollContext(null);
        }

        if (isFeatureEnabled('clientSessionSnapshot')) {
          saveClientSnapshot(sessionId, data);
        }

        const lines = [
          ...(data.sceneStarter ? [`— ${data.sceneStarter}`] : []),
          data.narration,
          ...(data.engineResults?.map((r) => `• ${r.summary}`) ?? []),
          ...(data.narrationWarnings?.length ? [`(DM note: ${data.narrationWarnings[0]})`] : []),
          `Turn ${data.recap.turnNumber} saved.`,
          data.nextHook,
        ];
        setHistory((h) => [...h, ...lines]);
      } catch {
        setHistory((h) => [...h, 'The guide pauses, then resumes. Try that action again.']);
      } finally {
        setBusy(false);
      }
    },
    [busy, physicalDice, sessionId],
  );

  function handleNewGame() {
    router.push('/start');
  }

  if (!sessionId) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-zinc-600">Loading session…</p>
        <p className="mt-4 text-sm">
          <Link href="/start" className="underline">
            Set up a new character and scenario
          </Link>
        </p>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 p-6 md:grid-cols-[2fr_1fr]">
        <section className="rounded-lg border border-zinc-300 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <header className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">{adventureTitle}</h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Scene: <b>{sceneId}</b> · {sceneGoal}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Mode: {mode === 'ai_director' ? 'AI Director' : 'Table rules'}
                {turnCount > 0 ? ` · Turn ${turnCount}` : ''}
              </p>
            </div>
            <button
              onClick={handleExportRecap}
              className="rounded border border-zinc-200 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Export Recap
            </button>
          </header>

          {showOnboarding && turnCount === 0 && (
            <div className="mt-4">
              <OnboardingBanner
                sceneId={sceneId}
                adventureId={adventureId}
                onDismiss={() => setShowOnboarding(false)}
              />
            </div>
          )}

          <NarrationPanel lines={history} busy={busy} />
          <DiceResults rolls={recentRolls} />
          <CombatHUD
            combat={state?.combat ?? { active: false, initiative: [], turnIndex: 0 }}
            playerName={state?.party?.find(p => p.id === state.activeCharacterId)?.name ?? state?.party?.[0]?.name ?? 'Hero'}
            monsters={state?.monsters ?? []}
          />
          <InputBox
            value={input}
            busy={busy}
            onChange={setInput}
            onSubmit={() => sendTurn(input)}
            placeholder="Describe what you do…"
          />
          {isFeatureEnabled('appealTheDm') && (
            <AppealButton
              busy={busy}
              onAppeal={() => {
                const detail = input.trim();
                sendTurn(
                  detail
                    ? `[APPEAL] ${detail}`
                    : '[APPEAL] I want to question the last ruling — please explain or reconsider.',
                );
              }}
            />
          )}

          {isFeatureEnabled('physicalDice') && (
            <div className="mt-4 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                id="physical-dice"
                checked={physicalDice}
                onChange={(e) => setPhysicalDice(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-700"
              />
              <label
                htmlFor="physical-dice"
                className="cursor-pointer text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                Use physical dice for rolls
              </label>
            </div>
          )}
          <ChoiceButtons choices={choices} busy={busy} onPick={(c) => sendTurn(c)} />
        </section>

        <aside className="rounded-lg border border-zinc-300 bg-white p-4 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="font-semibold">Character</h2>
          <CharacterSheet state={state} />
          {warnings.length > 0 && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-300" title={warnings.join(' ')}>
              Narration checked against engine state.
            </p>
          )}
        </aside>

        <AmbientAudio type={ambient} />

      {manualRollContext && (
        <ManualRollModal 
          context={manualRollContext} 
          onSubmit={(roll) => sendTurn('', roll)} 
        />
      )}
    </main>

      {sceneId === 'ending' && (
        <EndingScreen
          sessionId={sessionId}
          adventureTitle={adventureTitle}
          playerName={state?.party?.[0]?.name ?? 'Hero'}
          onNewGame={handleNewGame}
        />
      )}
    </>
  );
}
