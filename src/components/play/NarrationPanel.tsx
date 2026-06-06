type Props = {
  lines: string[];
  busy: boolean;
};

export function NarrationPanel({ lines, busy }: Props) {
  return (
    <section
      className="mt-4 h-[380px] overflow-y-auto rounded border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      aria-live="polite"
      aria-busy={busy}
      aria-label="Adventure narration"
      role="log"
    >
      {lines.map((line, i) => (
        <p key={`${i}-${line.slice(0, 24)}`} className="mb-2 whitespace-pre-wrap leading-relaxed">
          {line}
        </p>
      ))}
      {busy && <p className="text-zinc-500 italic">The DM considers your action…</p>}
    </section>
  );
}
