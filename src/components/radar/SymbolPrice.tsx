import type { SymbolContext } from "@/lib/htf-status";
import { formatDayChangePct } from "@/lib/day-change";
import { formatPrice } from "@/lib/strategy-prep";

export function SymbolPrice({
  symbol,
  livePrice,
}: {
  symbol: SymbolContext;
  livePrice?: number | null;
}) {
  const change = symbol.dayChange;
  const price = livePrice ?? symbol.current;

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
