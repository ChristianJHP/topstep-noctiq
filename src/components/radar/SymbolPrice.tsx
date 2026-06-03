"use client";

import { useEffect, useRef, useState } from "react";
import type { SymbolContext } from "@/lib/htf-status";
import { dayChangeFromPriorClose, formatDayChangePct } from "@/lib/day-change";
import { formatPrice } from "@/lib/strategy-prep";
import type { LiveQuote } from "@/lib/yahoo-live-quote";
import { PriceSkeleton } from "@/components/radar/LiveSkeleton";

export function SymbolPrice({
  symbol,
  liveQuote,
  loading = false,
}: {
  symbol: SymbolContext;
  liveQuote?: LiveQuote | null;
  loading?: boolean;
}) {
  const price = liveQuote?.price ?? symbol.current;
  const change =
    dayChangeFromPriorClose(price, liveQuote?.previousClose) ??
    symbol.dayChange;

  const [tick, setTick] = useState(false);
  const prevPriceRef = useRef(price);

  useEffect(() => {
    if (loading || price <= 0) return;
    if (
      prevPriceRef.current > 0 &&
      Math.abs(prevPriceRef.current - price) >= 0.01
    ) {
      setTick(true);
      const timer = window.setTimeout(() => setTick(false), 420);
      prevPriceRef.current = price;
      return () => window.clearTimeout(timer);
    }
    prevPriceRef.current = price;
  }, [price, loading]);

  if (loading && price <= 0) {
    return <PriceSkeleton />;
  }

  const delaySec = liveQuote?.delaySec;
  const showDelay = delaySec != null && delaySec > 90;
  const delayLabel =
    delaySec != null && delaySec >= 60
      ? `~${Math.round(delaySec / 60)}m delayed`
      : delaySec != null && delaySec > 90
        ? `${delaySec}s delayed`
        : null;

  return (
    <div className="sym-col-price-wrap">
      <p
        className={`sym-col-price${tick ? " sym-col-price--tick" : ""}`}
        suppressHydrationWarning
      >
        {formatPrice(price)}
      </p>
      {showDelay && delayLabel ? (
        <p className="sym-col-price-delay" title={`Source: ${liveQuote?.source ?? "unknown"}`}>
          {delayLabel}
        </p>
      ) : liveQuote?.source === "databento" || liveQuote?.source === "projectx" ? (
        <p className="sym-col-price-live">
          <span className="live-pulse-dot" aria-hidden />
          Live
        </p>
      ) : null}
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
