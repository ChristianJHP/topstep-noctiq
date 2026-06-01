import type { SymbolPrep } from "@/lib/strategy-prep";
import { formatCandleCountdown } from "@/lib/candle-timers";

type BiasStripProps = {
  prep: SymbolPrep;
  fifteenMMs: number | null;
  oneHMs: number | null;
  fourHMs: number | null;
  candlesPaused: boolean;
};

export function BiasStrip({
  prep,
  fifteenMMs,
  oneHMs,
  fourHMs,
  candlesPaused,
}: BiasStripProps) {
  const { bias, label } = prep;
  const biasLabel =
    bias === "bullish" ? "BULL" : bias === "bearish" ? "BEAR" : "MIX";
  const biasGlyph = bias === "bullish" ? "▲" : bias === "bearish" ? "▼" : "◆";

  const timers = [
    { key: "15M", ms: fifteenMMs },
    { key: "1H", ms: oneHMs },
    { key: "4H", ms: fourHMs },
  ] as const;

  return (
    <div className="bias-strip">
      <div className={`bias-strip-cell bias-strip-cell--${bias}`}>
        <span className="bias-strip-k">{label}</span>
        <span className="bias-glyph" aria-hidden>
          {biasGlyph}
        </span>
        <span className="bias-strip-val">{biasLabel}</span>
        {prep.esConfirm != null ? (
          <span
            className={`bias-es-pip${prep.esConfirm ? " bias-es-pip--ok" : " bias-es-pip--warn"}`}
            title={prep.esConfirm ? "ES confirms" : "ES diverging"}
          />
        ) : null}
      </div>

      <div className="bias-strip-cell bias-strip-cell--timers">
        <span className="bias-strip-k bias-strip-k--timers">Closes in</span>
        <div className="bias-timer-row">
          {timers.map(({ key, ms }) => (
            <div key={key} className="bias-timer-block">
              <span className="bias-timer-k">{key}</span>
              <span className="bias-timer-v" suppressHydrationWarning>
                {candlesPaused ? "—" : formatCandleCountdown(ms)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
