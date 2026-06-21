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
import { FailedCheckRecovery } from '@/components/play/FailedCheckRecovery';
import { CampaignMemory } from '@/components/play/CampaignMemory';
import { DevPanelToggle } from '@/components/play/DevPanelToggle';
import { useDevPanelSettings } from '@/lib/play/dev-panel';
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
  const [lastEngineResults, setLastEngineResults] = useState<TurnResponse['engineResults']>([]);
  const [ambient, setAmbient] = useState<TurnResponse['ambient']>('none');
  const [physicalDice, setPhysicalDice] = useState(false);
  const [manualRollContext, setManualRollContext] = useState<TurnResponse['manualRollContext'] | null>(null);
  const [showMobileCharacterSheet, setShowMobileCharacterSheet] = useState(false);
  const { settings: devPanel, setSetting: setDevPanel } = useDevPanelSettings();

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
    const hydratedOpening = data.sceneStarter ?? data.opening;
    if (typeof hydratedOpening === 'string' && hydratedOpening.trim()) {
      setHistory([hydratedOpening]);
    }
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
        const { sessionId: openingSessionId, opening, title, adventureId: openingAdventureId, state: openingState, sceneId: openingSceneId, sceneGoal: openingSceneGoal, nextChoices } = JSON.parse(openingRaw) as {
          sessionId?: string;
          opening: string;
          title: string;
          adventureId?: string;
          state?: TurnResponse['state'];
          sceneId?: TurnResponse['sceneId'];
          sceneGoal?: string;
          nextChoices?: string[];
        };
        sessionStorage.removeItem('partyquest-opening');
        if (openingSessionId) setSessionId(openingSessionId);
        setAdventureTitle(title);
        setHistory([opening]);
        if (openingAdventureId) setAdventureId(openingAdventureId);
        if (openingState) setState(openingState);
        if (openingSceneId) setSceneId(openingSceneId);
        if (openingSceneGoal) setSceneGoal(openingSceneGoal);
        if (nextChoices) setChoices(nextChoices);
        setMode('table_rules');
        setAmbient('none');
        return;
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
            adventureId,
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
        setLastEngineResults(data.engineResults ?? []);
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
    [adventureId, busy, physicalDice, sessionId],
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
        <section className="rounded-lg border border-zinc-300 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 flex flex-col h-[calc(100vh-48px)]">
          <header className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">{adventureTitle}</h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Scene: <b>{sceneId}</b> · {sceneGoal}
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="rounded-full border border-zinc-300 px-2 py-1 font-semibold dark:border-zinc-700">
                  {mode === 'ai_director' ? 'AI Director' : 'Table Rules'}
                </span>
                <span>
                  Active: {state?.party?.find((member) => member.id === state.activeCharacterId)?.name ?? 'Not set'}
                </span>
                {turnCount > 0 ? <span>Turn {turnCount}</span> : null}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMobileCharacterSheet(true)}
                className="md:hidden rounded border border-zinc-200 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Character
              </button>
              <button
                onClick={handleExportRecap}
                className="rounded border border-zinc-200 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Export Recap
              </button>
              <DevPanelToggle settings={devPanel} setSetting={setDevPanel} />
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            {showOnboarding && turnCount === 0 && (
              <div className="mt-4">
                <OnboardingBanner
                  sceneId={sceneId}
                  adventureId={adventureId}
                  sceneGoal={sceneGoal}
                  choices={choices}
                  onDismiss={() => setShowOnboarding(false)}
                />
              </div>
            )}

            <NarrationPanel lines={history} busy={busy} />
            <DiceResults rolls={recentRolls} />
            <FailedCheckRecovery
              failedResult={lastEngineResults.find((result) => result.kind === 'skill_check' && !result.ok)}
              choices={choices}
            />
            <CombatHUD
              combat={state?.combat ?? { active: false, initiative: [], turnIndex: 0 }}
              party={state?.party ?? []}
              monsters={state?.monsters ?? []}
            />
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
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
                lastEngineResults={lastEngineResults}
                recentRolls={recentRolls}
                state={state}
                onAppeal={(detail) => sendTurn(`[APPEAL] ${detail}`)}
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
          </div>
        </section>

        <aside className="rounded-lg border border-zinc-300 bg-white p-4 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900 hidden md:block">
          <h2 className="font-semibold">Character</h2>
          <CharacterSheet state={state} />
          <CampaignMemory state={state} sceneGoal={sceneGoal} choices={choices} />
          {process.env.NODE_ENV !== 'production' && warnings.length > 0 && (
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

    {/* Mobile character sheet drawer */}
    {showMobileCharacterSheet && (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:hidden">
        <div className="w-full max-w-lg rounded-t-3xl bg-white p-6 dark:bg-zinc-900">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Character</h2>
            <button
              onClick={() => setShowMobileCharacterSheet(false)}
              className="rounded border border-zinc-200 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Close
            </button>
          </div>
          <CharacterSheet state={state} />
          <CampaignMemory state={state} sceneGoal={sceneGoal} choices={choices} />
          {process.env.NODE_ENV !== 'production' && warnings.length > 0 && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-300" title={warnings.join(' ')}>
              Narration checked against engine state.
            </p>
          )}
        </div>
      </div>
    )}

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
