"use client";

import { useState } from "react";
import type { MarketContext } from "@/lib/htf-status";
import { MARKET_TICKERS } from "@/lib/chart-data";
import { InstrumentBiasSummary } from "@/components/radar/InstrumentBiasSummary";
import { SymbolColumn } from "@/components/radar/SymbolColumn";
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
  chartCandles?: Record<string, ChartCandlesPayload>;
};

export function MarketBoard({
  markets,
  chartCandles,
}: MarketBoardProps) {
  const [tab, setTab] = useState<RadarTab>("NQ");
  usePrefetchChartCandles(chartCandles);

  const activeTicker =
    tab === "NQ"
      ? MARKET_TICKERS.NQ
      : tab === "ES"
        ? MARKET_TICKERS.ES
        : MARKET_TICKERS.GC;
  const liveQuote = useLiveQuote(activeTicker);

  const symbol =
    tab === "NQ" ? markets.nq : tab === "ES" ? markets.es : markets.gold;

  return (
    <section className="mr-board live-enter">
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

        <InstrumentBiasSummary symbol={tab} />

        <SymbolColumn symbol={symbol} liveQuote={liveQuote} />

        <MarketNewsFeed instrument={tab} />
      </div>
    </section>
  );
}
