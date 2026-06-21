'use client';

import type { DevPanelSettings } from '@/lib/play/dev-panel';
import type { EngineLogEntry } from '@/lib/play/dev-panel-format';
import type { TurnResponse } from '@/lib/play/types';
import { EngineLogPanel } from '@/components/play/EngineLogPanel';
import { MonsterStatBlock } from '@/components/play/MonsterStatBlock';
import { ActionEconomyPanel } from '@/components/play/ActionEconomyPanel';

type Props = {
  settings: DevPanelSettings;
  state: TurnResponse['state'] | null;
  engineLog: EngineLogEntry[];
  warnings: string[];
};

/**
 * Container for the DM-view ("behind the scenes") panels. Each section renders
 * only when its toggle is on; with everything off this renders nothing, keeping
 * the default player view clean.
 */
export function DmPanels({ settings, state, engineLog, warnings, showAny }: Props & { showAny: boolean }) {
  if (!showAny) return null;
  return (
    <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-700">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">DM View</p>
      {settings.showNarrationWarnings && warnings.length > 0 && (
        <section className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-800 dark:bg-amber-950/20">
          <p className="font-semibold text-amber-900 dark:text-amber-200">Narration warnings</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[10px] text-amber-900 dark:text-amber-200">
            {warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </section>
      )}
      {settings.showMonsterStatBlocks && <MonsterStatBlock monsters={state?.monsters ?? []} />}
      {settings.showActionEconomy && <ActionEconomyPanel state={state} />}
      {(settings.showEngineLog || settings.showCoverLOS || settings.showOpportunityAttacks) && (
        <EngineLogPanel
          entries={engineLog}
          showEngineLog={settings.showEngineLog}
          showCoverLOS={settings.showCoverLOS}
          showOpportunityAttacks={settings.showOpportunityAttacks}
        />
      )}
    </div>
  );
}
