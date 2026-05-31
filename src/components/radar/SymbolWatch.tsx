import type { WatchChip } from "@/lib/strategy-prep";

export function SymbolWatch({ chips }: { chips: WatchChip[] }) {
  if (!chips.length) return null;

  return (
    <div className="signal-chips" aria-live="polite">
      {chips.map((chip) => (
        <span
          key={chip.id}
          className={`signal-chip signal-chip--${chip.tone}`}
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}
