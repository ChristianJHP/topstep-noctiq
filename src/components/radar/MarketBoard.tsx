"use client";

import { useState } from "react";
import type { MarketContext } from "@/lib/htf-status";
import { MARKET_TICKERS } from "@/lib/chart-data";
import type { TradingSessionLabel } from "@/lib/trading-session";
import { MarketContextCard } from "@/components/radar/MarketContextCard";
import { SymbolColumn } from "@/components/radar/SymbolColumn";
import { ContextFeed } from "@/components/radar/ContextFeed";
import { MarketNewsFeed } from "@/components/radar/MarketNewsFeed";
import { usePrefetchChartCandles } from "@/hooks/use-prefetch-chart-candles";
import { useLiveQuote } from "@/hooks/use-live-quote";
import type { ChartCandlesPayload } from "@/lib/chart-candles-cache";

export type RadarTab = "NQ" | "ES" | "GC";

const TABS: { id: RadarTab; label: string }[] = [
  { id: "NQ", label: "NQ" },
  { id: "ES", label: "ES" },
  { id: "GC", label: "Gold" },
];

type MarketBoardProps = {
  markets: MarketContext;
  fifteenMMs: number | null;
  candlesPaused: boolean;
  chartCandles?: Record<string, ChartCandlesPayload>;
  sessionLabel: TradingSessionLabel | "Closed";
};

export function MarketBoard({
  markets,
  fifteenMMs,
  candlesPaused,
  chartCandles,
  sessionLabel,
}: MarketBoardProps) {
  const [tab, setTab] = useState<RadarTab>("NQ");
  usePrefetchChartCandles(chartCandles);

  const nqQuote = useLiveQuote(MARKET_TICKERS.NQ);
  const esQuote = useLiveQuote(MARKET_TICKERS.ES);
  const gcQuote = useLiveQuote(MARKET_TICKERS.GC);

  const symbol =
    tab === "NQ" ? markets.nq : tab === "ES" ? markets.es : markets.gold;
  const liveQuote =
    tab === "NQ" ? nqQuote : tab === "ES" ? esQuote : gcQuote;

  return (
    <section className="mr-board">
      <div className="mr-symbol-panel">
        <div className="mr-tabs" role="tablist" aria-label="Symbol">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`mr-tab${tab === id ? " mr-tab--active" : ""}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <ContextFeed instrument={tab} />

        <MarketContextCard
          symbol={symbol}
          session={sessionLabel}
          fifteenMMs={fifteenMMs}
          candlesPaused={candlesPaused}
          liveQuote={liveQuote}
        />

        <SymbolColumn
          key={tab}
          symbol={symbol}
          liveQuote={liveQuote}
        />

        <MarketNewsFeed instrument={tab} />
      </div>
    </section>
  );
}
