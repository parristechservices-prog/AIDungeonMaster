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
import { Battlemap } from '@/components/play/Battlemap';
import { ThemeToggle } from '@/components/theme-toggle';
import { DisplaySettingsPanel } from '@/components/play/DisplaySettingsPanel';
import { usePlayDisplaySettings } from '@/lib/play/display-settings';
import { DmPanels } from '@/components/play/DmPanels';
import { useDevPanelSettings, anyDevPanelSectionEnabled } from '@/lib/play/dev-panel';
import type { EngineLogEntry } from '@/lib/play/dev-panel-format';
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
  const [showMobileMap, setShowMobileMap] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'character' | 'map'>('character');
  const { settings: display, toggle: toggleDisplay, reset: resetDisplay, setPreset: setDisplayPreset } = usePlayDisplaySettings();
  const { settings: devPanel, setSetting: setDevPanel } = useDevPanelSettings();
  const [engineLog, setEngineLog] = useState<EngineLogEntry[]>([]);
  const showDmPanels = anyDevPanelSectionEnabled(devPanel);

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
        setEngineLog((prev) =>
          [{ turn: data.recap?.turnNumber ?? prev.length + 1, input: nextInput, results: data.engineResults ?? [] }, ...prev].slice(0, 50),
        );
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
      {/* Full-viewport app shell — no page scroll */}
      <div className="h-[100dvh] overflow-hidden flex flex-col bg-zinc-100 dark:bg-zinc-950">
        <div className="flex flex-1 min-h-0 gap-0 md:gap-4 md:p-3 overflow-hidden">

          {/* ── LEFT: Main game panel ── */}
          <section className="flex flex-col flex-1 min-h-0 rounded-none md:rounded-lg border-0 md:border border-zinc-300 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900 overflow-hidden">

            {/* Panel header — stacks on mobile (title row, then wrapping controls) */}
            <header className="shrink-0 flex flex-col gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-700 md:flex-row md:items-start md:justify-between md:px-4 md:pt-4 md:pb-3">
              <div className="min-w-0">
                <h1 className="text-base font-bold leading-tight line-clamp-2 md:text-xl md:truncate">{adventureTitle}</h1>
                {display.showSceneMeta && (
                  <p className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400 md:text-xs">
                    Scene: <b>{sceneId}</b> · {sceneGoal}
                  </p>
                )}
                {(display.showModePill || display.showActiveCharacter || (display.showTurnNumber && turnCount > 0)) && (
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500 md:text-xs">
                    {display.showModePill && (
                      <span className="rounded-full border border-zinc-300 px-2 py-0.5 font-semibold dark:border-zinc-700">
                        {mode === 'ai_director' ? 'AI Director' : 'Table Rules'}
                      </span>
                    )}
                    {display.showActiveCharacter && (
                      <span>
                        Active: {state?.party?.find((m) => m.id === state.activeCharacterId)?.name ?? 'Not set'}
                      </span>
                    )}
                    {display.showTurnNumber && turnCount > 0 ? <span>Turn {turnCount}</span> : null}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 md:shrink-0 md:justify-end">
                {display.showCharacterButton && (
                  <button
                    onClick={() => setShowMobileCharacterSheet(true)}
                    className="md:hidden rounded border border-zinc-200 px-2 py-1 text-[11px] font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    Character
                  </button>
                )}
                {display.showMapButton && (
                  <button
                    onClick={() => setShowMobileMap(true)}
                    className="md:hidden rounded border border-zinc-200 px-2 py-1 text-[11px] font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    {state?.combat?.active ? 'Map ⚔' : 'Map'}
                  </button>
                )}
                {display.showDmViewButton && <DevPanelToggle settings={devPanel} setSetting={setDevPanel} />}
                {display.showExportButton && (
                  <button
                    onClick={handleExportRecap}
                    className="rounded border border-zinc-200 px-2 py-1 text-[11px] font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    Export
                  </button>
                )}
                {display.showThemeButton && (
                  <ThemeToggle floating={false} className="rounded border border-zinc-200 px-2 py-1 text-[11px] font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800" />
                )}
                {/* Always visible so the player can never hide their way out. */}
                <DisplaySettingsPanel settings={display} toggle={toggleDisplay} reset={resetDisplay} setPreset={setDisplayPreset} />
                {display.showBackButton && (
                  <Link
                    href="/start"
                    className="rounded border border-zinc-200 px-2 py-1 text-[11px] font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    ← Back
                  </Link>
                )}
              </div>
            </header>

            {/* Scrollable story area */}
            <div className={`flex flex-col flex-1 min-h-0 px-4 overflow-hidden gap-2 ${display.compactMode ? 'py-1.5' : 'py-3'}`}>
              {showOnboarding && turnCount === 0 && (
                <div className="shrink-0">
                  <OnboardingBanner
                    sceneId={sceneId}
                    adventureId={adventureId}
                    sceneGoal={sceneGoal}
                    choices={choices}
                    onDismiss={() => setShowOnboarding(false)}
                  />
                </div>
              )}

              {/* NarrationPanel is flex-1 min-h-0 — it owns the scroll */}
              {display.showNarration ? (
                <NarrationPanel lines={history} busy={busy} />
              ) : (
                <div className="flex-1 min-h-0 rounded border border-dashed border-zinc-300 p-3 text-xs text-zinc-500 dark:border-zinc-700">
                  Narration hidden — open Display settings to restore.
                </div>
              )}

              <div className="shrink-0">
                {display.showDicePanel && <DiceResults rolls={recentRolls} />}
                <FailedCheckRecovery
                  failedResult={lastEngineResults.find((r) => r.kind === 'skill_check' && !r.ok)}
                  choices={choices}
                />
                <CombatHUD
                  combat={state?.combat ?? { active: false, initiative: [], turnIndex: 0 }}
                  party={state?.party ?? []}
                  monsters={state?.monsters ?? []}
                  showTerrainOverlay={devPanel.showTerrainOverlay}
                />
              </div>
            </div>

            {/* Composer — always pinned at the bottom of the panel (safe-area aware) */}
            <div
              className="shrink-0 px-4 pt-3 border-t border-zinc-200 dark:border-zinc-700 space-y-2"
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            >
              {/* Docked ambient audio bar — in flow, never overlays input/suggestions */}
              {display.showAudio && <AmbientAudio type={ambient} />}
              <InputBox
                value={input}
                busy={busy}
                onChange={setInput}
                onSubmit={() => sendTurn(input)}
                placeholder="Describe what you do…"
              />
              {display.showAppealDm && isFeatureEnabled('appealTheDm') && (
                <AppealButton
                  busy={busy}
                  lastEngineResults={lastEngineResults}
                  recentRolls={recentRolls}
                  state={state}
                  onAppeal={(detail) => sendTurn(`[APPEAL] ${detail}`)}
                />
              )}
              {display.showPhysicalDiceToggle && isFeatureEnabled('physicalDice') && (
                <div className="flex items-center gap-2 text-xs">
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
                    Use physical dice
                  </label>
                </div>
              )}
              {display.showSuggestedActions && <ChoiceButtons choices={choices} busy={busy} onPick={(c) => sendTurn(c)} />}
            </div>
          </section>

          {/* ── RIGHT: Sidebar ── */}
          <aside className="hidden md:flex flex-col w-72 lg:w-96 shrink-0 min-h-0 rounded-lg border border-zinc-300 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900 overflow-hidden">
            <div className="shrink-0 flex gap-1 px-2 pt-2 pb-1 border-b border-zinc-200 dark:border-zinc-700">
              {(['character', 'map'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  className={`flex-1 rounded px-2 py-1 text-xs font-semibold capitalize ${
                    sidebarTab === tab
                      ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900'
                      : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                  }`}
                >
                  {tab === 'map' && state?.combat?.active ? 'Map ⚔' : tab}
                </button>
              ))}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 text-sm space-y-4">
              {sidebarTab === 'character' ? (
                <>
                  <CharacterSheet state={state} />
                  <CampaignMemory state={state} sceneGoal={sceneGoal} choices={choices} />
                  {process.env.NODE_ENV !== 'production' && warnings.length > 0 && (
                    <p className="text-xs text-amber-700 dark:text-amber-300" title={warnings.join(' ')}>
                      Narration checked against engine state.
                    </p>
                  )}
                  <DmPanels settings={devPanel} state={state} engineLog={engineLog} warnings={warnings} showAny={showDmPanels} />
                </>
              ) : (
                <Battlemap state={state} showTerrainOverlay={devPanel.showTerrainOverlay} onSuggestCommand={setInput} />
              )}
            </div>
          </aside>

        </div>
      </div>

      {manualRollContext && (
        <ManualRollModal
          context={manualRollContext}
          onSubmit={(roll) => sendTurn('', roll)}
        />
      )}

      {/* Mobile character sheet drawer */}
      {showMobileCharacterSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:hidden">
          <div className="w-full max-w-lg rounded-t-3xl bg-white p-6 dark:bg-zinc-900 max-h-[80vh] overflow-y-auto">
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
            <DmPanels settings={devPanel} state={state} engineLog={engineLog} warnings={warnings} showAny={showDmPanels} />
          </div>
        </div>
      )}

      {/* Mobile battle map drawer */}
      {showMobileMap && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:hidden">
          <div className="w-full max-w-lg rounded-t-3xl bg-white p-6 dark:bg-zinc-900 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Battle map</h2>
              <button
                onClick={() => setShowMobileMap(false)}
                className="rounded border border-zinc-200 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Close
              </button>
            </div>
            <Battlemap
              state={state}
              showTerrainOverlay={devPanel.showTerrainOverlay}
              onSuggestCommand={(cmd) => {
                setInput(cmd);
                setShowMobileMap(false);
              }}
            />
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
