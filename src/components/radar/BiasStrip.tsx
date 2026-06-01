import type { SymbolPrep } from "@/lib/strategy-prep";
import { formatCountdownHuman } from "@/lib/candle-timers";
import { formatPrice } from "@/lib/strategy-prep";

type BiasStripProps = {
  prep: SymbolPrep;
  oneHMs: number | null;
  fourHMs: number | null;
  candlesPaused: boolean;
};

export function BiasStrip({
  prep,
  oneHMs,
  fourHMs,
  candlesPaused,
}: BiasStripProps) {
  const { bias, draw, label } = prep;
  const biasLabel =
    bias === "bullish" ? "BULL" : bias === "bearish" ? "BEAR" : "MIX";
  const biasGlyph = bias === "bullish" ? "▲" : bias === "bearish" ? "▼" : "◆";

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

      <div className="bias-strip-cell">
        <span className="bias-strip-k">Draw</span>
        <span className="bias-draw-glyph" aria-hidden>
          {draw.side === "buy-side" ? "↑" : "↓"}
        </span>
        <span className="bias-strip-val bias-strip-val--num">
          {formatPrice(draw.level)}
        </span>
        <span className="bias-strip-pts">{Math.round(draw.pointsAway)}pt</span>
      </div>

      <div
        className={`bias-strip-cell${prep.nearKeyLevel || prep.smt ? " bias-strip-cell--live" : ""}`}
      >
        <span className="bias-strip-k">Confirm</span>
        <span className="confirm-pip" aria-hidden />
        <span className="bias-strip-val">{prep.confirmLabel}</span>
      </div>

      <div className="bias-strip-cell bias-strip-cell--timers">
        <span className="bias-strip-k">Candles</span>
        <span className="bias-timer">
          1H {candlesPaused ? "—" : formatCountdownHuman(oneHMs)}
        </span>
        <span className="bias-timer">
          4H {candlesPaused ? "—" : formatCountdownHuman(fourHMs)}
        </span>
      </div>
    </div>
  );
}
