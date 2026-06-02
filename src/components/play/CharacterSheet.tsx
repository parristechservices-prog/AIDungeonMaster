import type { TurnResponse } from '@/lib/play/types';

type State = TurnResponse['state'];

type Props = {
  state: State | null;
};

export function CharacterSheet({ state }: Props) {
  if (!state) {
    return <p className="mt-2 text-zinc-600">Send your first action to begin.</p>;
  }

  return (
    <>
      <p className="mt-2">{state.player.name}</p>
      <div className="flex flex-col gap-1">
        <p className={`font-medium ${state.player.hp === 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
          HP: {state.player.hp}/{state.player.maxHp}
          {state.player.unconscious && ' (Unconscious)'}
        </p>
        {state.player.unconscious && (
          <div className="text-[10px] bg-red-50 dark:bg-red-950/30 p-1.5 rounded border border-red-200 dark:border-red-900">
            <p className="font-bold uppercase tracking-wider mb-1">Death Saves</p>
            <div className="flex gap-4">
              <span>Success: {state.player.deathSaves.success}/3</span>
              <span>Failure: {state.player.deathSaves.failure}/3</span>
            </div>
          </div>
        )}
        <p>AC: {state.player.ac}</p>
        <p>Gold: {state.player.gold}gp</p>
      </div>

      <p className="mt-2 font-semibold">Inventory</p>
      <div className="max-h-32 overflow-y-auto text-xs">
        {state.player.inventory.length > 0 ? (
          <ul className="list-inside list-disc">
            {state.player.inventory.map((item, i) => (
              <li key={`${item}-${i}`}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="italic text-zinc-500">Empty.</p>
        )}
      </div>

      <p className="mt-2 font-semibold">Features</p>
      {state.player.features.map((f) => (
        <p key={f.id}>
          {f.name}: {f.usesRemaining} use(s)
        </p>
      ))}

      {Object.keys(state.player.spellSlots).length > 0 && (
        <>
          <p className="mt-2 font-semibold">Spell slots</p>
          {Object.entries(state.player.spellSlots).map(([lvl, s]) => (
            <p key={lvl}>
              Level {lvl}: {s.remaining}/{s.max}
            </p>
          ))}
        </>
      )}

      <p className="mt-3 font-semibold">Enemies</p>
      {state.monsters.length > 0 ? (
        state.monsters.map((m) => (
          <p key={m.id}>
            {m.name}: {m.hp}/{m.maxHp} HP (AC {m.ac})
          </p>
        ))
      ) : (
        <p className="italic text-zinc-500">None visible.</p>
      )}

      <p className="mt-3 font-semibold">NPCs</p>
      {state.npcs.length > 0 ? (
        state.npcs.map((n) => (
          <p key={n.id} title={n.description}>
            {n.name} ({n.disposition})
          </p>
        ))
      ) : (
        <p className="italic text-zinc-500">None nearby.</p>
      )}

      <p className="mt-3 font-semibold">Canon facts</p>
      <div className="max-h-40 overflow-y-auto">
        {state.canonLog.length > 0 ? (
          state.canonLog.map((f) => (
            <p key={f.id} className="mb-1 text-xs">
              • {f.content}
            </p>
          ))
        ) : (
          <p className="italic text-zinc-500">No facts established yet.</p>
        )}
      </div>
    </>
  );
}
