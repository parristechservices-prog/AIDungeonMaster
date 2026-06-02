type Props = {
  value: string;
  busy: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function InputBox({ value, busy, placeholder, onChange, onSubmit }: Props) {
  return (
    <div className="mt-3 flex gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        disabled={busy}
        className="flex-1 rounded border border-zinc-300 bg-white px-3 py-2 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
        placeholder={placeholder}
        aria-label="Player action"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={busy || !value.trim()}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-black"
      >
        {busy ? '…' : 'Send'}
      </button>
    </div>
  );
}
