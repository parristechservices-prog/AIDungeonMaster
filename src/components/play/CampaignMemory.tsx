import type { TurnResponse } from '@/lib/play/types';

type State = TurnResponse['state'];

type Props = {
  state: State | null;
  sceneGoal?: string;
  choices?: string[];
};

function byImportance(a: State['canonLog'][number], b: State['canonLog'][number]) {
  const rank = { high: 0, medium: 1, low: 2 };
  return rank[a.importance] - rank[b.importance];
}

export function CampaignMemory({ state, sceneGoal, choices = [] }: Props) {
  if (!state) {
    return (
      <section className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Campaign Memory</h3>
        <p className="mt-2 text-xs italic text-zinc-500">Memory will fill in as the adventure establishes facts.</p>
      </section>
    );
  }

  const canonFacts = [...(state.canonLog ?? [])].sort(byImportance);
  const knownItems = [...new Set(state.party.flatMap((member) => member.inventory ?? []))];
  const npcNotes = state.npcs.flatMap((npc) =>
    npc.knowledge.length > 0
      ? npc.knowledge.map((note) => ({ npcName: npc.name, disposition: npc.disposition, note }))
      : [{ npcName: npc.name, disposition: npc.disposition, note: npc.description }],
  );

  return (
    <section className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Campaign Memory</h3>
        <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:border-zinc-700">
          {canonFacts.length} facts
        </span>
      </div>

      {sceneGoal && (
        <div className="mt-3 rounded border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Current Thread</p>
          <p className="mt-1 text-xs text-zinc-700 dark:text-zinc-300">{sceneGoal}</p>
        </div>
      )}

      <div className="mt-3 space-y-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Truths</p>
          <div className="mt-1 max-h-36 overflow-y-auto border-l-2 border-zinc-100 pl-3 dark:border-zinc-800">
            {canonFacts.length > 0 ? (
              canonFacts.slice(0, 8).map((fact) => (
                <p key={fact.id} className="mb-2 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  <span className="font-semibold uppercase text-zinc-400">{fact.importance}</span> {fact.content}
                </p>
              ))
            ) : (
              <p className="text-xs italic text-zinc-500">No facts established yet.</p>
            )}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">People</p>
          <div className="mt-1 space-y-1">
            {npcNotes.length > 0 ? (
              npcNotes.slice(0, 6).map((npc, index) => (
                <p key={`${npc.npcName}-${index}`} className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{npc.npcName}</span>
                  <span className="text-zinc-400"> ({npc.disposition}) </span>
                  {npc.note}
                </p>
              ))
            ) : (
              <p className="text-xs italic text-zinc-500">No NPC notes yet.</p>
            )}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Leads</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {choices.length > 0 ? (
              choices.slice(0, 4).map((choice) => (
                <span key={choice} className="rounded bg-zinc-100 px-2 py-1 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {choice}
                </span>
              ))
            ) : (
              <span className="text-xs italic text-zinc-500">No open leads shown.</span>
            )}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Shared Gear</p>
          <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
            {knownItems.length > 0 ? knownItems.slice(0, 10).join(', ') : 'No notable items yet.'}
          </p>
        </div>
      </div>
    </section>
  );
}
