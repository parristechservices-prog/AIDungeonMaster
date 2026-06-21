'use client';

import type { DevPanelSettings } from '@/lib/play/dev-panel';
import type { EngineLogEntry } from '@/lib/play/dev-panel-format';
import type { TurnResponse } from '@/lib/play/types';
import { EngineLogPanel } from '@/components/play/EngineLogPanel';

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
export function DmPanels({ settings, engineLog, showAny }: Props & { showAny: boolean }) {
  if (!showAny) return null;
  return (
    <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-700">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">DM View</p>
      {settings.showEngineLog && (
        <EngineLogPanel
          entries={engineLog}
          showCoverLOS={settings.showCoverLOS}
          showOpportunityAttacks={settings.showOpportunityAttacks}
        />
      )}
    </div>
  );
}
