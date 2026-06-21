type Props = {
  value: string;
  busy: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function InputBox({ value, busy, placeholder, onChange, onSubmit }: Props) {
  return (
    <div className="flex gap-2">
      <label htmlFor="player-action" className="sr-only">Describe your action</label>
      <input
        id="player-action"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        disabled={busy}
        className="min-h-11 flex-1 rounded border border-zinc-300 bg-white px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
        placeholder={placeholder}
        aria-label="Player action"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={busy || !value.trim()}
        className="min-h-11 rounded bg-black px-4 py-2 text-white outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 dark:bg-zinc-100 dark:text-black"
      >
        {busy ? '…' : 'Send'}
      </button>
    </div>
  );
}
