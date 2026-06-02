import { formatCandleCountdown } from "@/lib/candle-timers";

type CandleTimerStripProps = {
  fifteenMMs: number | null;
  oneHMs: number | null;
  fourHMs: number | null;
  candlesPaused: boolean;
};

export function CandleTimerStrip({
  fifteenMMs,
  oneHMs,
  fourHMs,
  candlesPaused,
}: CandleTimerStripProps) {
  const timers = [
    { key: "15M", ms: fifteenMMs },
    { key: "1H", ms: oneHMs },
    { key: "4H", ms: fourHMs },
  ] as const;

  return (
    <div className="candle-timer-strip" aria-label="Candle closes">
      <span className="candle-timer-strip-k">Closes</span>
      <div className="candle-timer-strip-row">
        {timers.map(({ key, ms }) => (
          <span key={key} className="candle-timer-strip-item">
            <span className="candle-timer-strip-label">{key}</span>
            <span className="candle-timer-strip-val" suppressHydrationWarning>
              {candlesPaused ? "—" : formatCandleCountdown(ms)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
