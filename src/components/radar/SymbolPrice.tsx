import type { SymbolContext } from "@/lib/htf-status";
import { dayChangeFromPriorClose, formatDayChangePct } from "@/lib/day-change";
import { formatPrice } from "@/lib/strategy-prep";
import type { LiveQuote } from "@/lib/yahoo-live-quote";

export function SymbolPrice({
  symbol,
  liveQuote,
}: {
  symbol: SymbolContext;
  liveQuote?: LiveQuote | null;
}) {
  const price = liveQuote?.price ?? symbol.current;
  const change =
    dayChangeFromPriorClose(price, liveQuote?.previousClose) ??
    symbol.dayChange;

  return (
    <div className="sym-col-price-wrap">
      <p className="sym-col-price">{formatPrice(price)}</p>
      {change ? (
        <p
          className={`sym-col-price-change${
            change.pct > 0
              ? " sym-col-price-change--up"
              : change.pct < 0
                ? " sym-col-price-change--down"
                : " sym-col-price-change--flat"
          }`}
        >
          <span className="sym-col-price-glyph" aria-hidden>
            {change.pct > 0 ? "▲" : change.pct < 0 ? "▼" : "—"}
          </span>
          {formatDayChangePct(change.pct)}
        </p>
      ) : null}
    </div>
  );
}
