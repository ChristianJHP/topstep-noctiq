import { formatPrice } from "@/lib/strategy-prep";

export type RangeMarker = {
  price: number;
  kind: "draw" | "fvg" | "cisd" | "current";
};

type RangeBarProps = {
  label: "4H" | "1H";
  low: number;
  high: number;
  pct: number;
  distToHigh: number;
  distToLow: number;
  markers?: RangeMarker[];
};

function pctOnTrack(price: number, low: number, high: number): number {
  if (high <= low) return 50;
  return Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100));
}

export function RangeBar({
  label,
  low,
  high,
  pct,
  distToHigh,
  distToLow,
  markers = [],
}: RangeBarProps) {
  const clamped = Math.max(0, Math.min(100, pct));
  const nearHigh = distToHigh <= distToLow;
  const distLabel = nearHigh
    ? `${Math.round(distToHigh)} pt to H`
    : `${Math.round(distToLow)} pt to L`;
  const zone = clamped >= 72 ? "high" : clamped <= 28 ? "low" : "mid";

  const trackMarkers = markers.filter(
    (m) => m.price >= low - 0.01 && m.price <= high + 0.01
  );

  return (
    <div className={`range-bar range-bar--${zone}`}>
      <div className="range-bar-meta">
        <span className="range-bar-label">{label} range</span>
        <span className="range-bar-dist">{distLabel}</span>
        <span className="range-bar-pct">{clamped}%</span>
      </div>
      <div
        className="range-bar-track"
        role="img"
        aria-label={`${label} range ${clamped}% · ${distLabel}`}
      >
        <div className="range-bar-fill" style={{ width: `${clamped}%` }} />
        <div className="range-bar-mark" style={{ left: `${clamped}%` }} />
        {trackMarkers.map((m) => (
          <div
            key={`${m.kind}-${m.price}`}
            className={`range-bar-pin range-bar-pin--${m.kind}`}
            style={{ left: `${pctOnTrack(m.price, low, high)}%` }}
            title={formatPrice(m.price)}
          />
        ))}
      </div>
      <div className="range-bar-bounds">
        <span>{formatPrice(low)}</span>
        <span>{formatPrice(high)}</span>
      </div>
    </div>
  );
}
