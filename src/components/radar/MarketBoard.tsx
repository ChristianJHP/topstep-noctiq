"use client";

import { useMemo, useState } from "react";
import type { MarketContext } from "@/lib/htf-status";
import { computeSymbolPrep } from "@/lib/strategy-prep";
import { BiasStrip } from "@/components/radar/BiasStrip";
import { SymbolColumn } from "@/components/radar/SymbolColumn";
import { usePrefetchChartCandles } from "@/hooks/use-prefetch-chart-candles";
import type { ChartCandlesPayload } from "@/lib/chart-candles-cache";

export type RadarTab = "NQ" | "ES" | "GC";

const TABS: { id: RadarTab; label: string }[] = [
  { id: "NQ", label: "NQ" },
  { id: "ES", label: "ES" },
  { id: "GC", label: "Gold" },
];

type MarketBoardProps = {
  markets: MarketContext;
  now: number;
  oneHMs: number | null;
  fourHMs: number | null;
  candlesPaused: boolean;
  chartCandles?: Record<string, ChartCandlesPayload>;
};

export function MarketBoard({
  markets,
  now,
  oneHMs,
  fourHMs,
  candlesPaused,
  chartCandles,
}: MarketBoardProps) {
  const [tab, setTab] = useState<RadarTab>("NQ");
  usePrefetchChartCandles(chartCandles);

  const symbol =
    tab === "NQ" ? markets.nq : tab === "ES" ? markets.es : markets.gold;

  const symbolPrep = useMemo(
    () => computeSymbolPrep(symbol, markets, new Date(now)),
    [symbol, markets, now]
  );

  return (
    <section className="mr-board">
      <BiasStrip
        prep={symbolPrep}
        oneHMs={oneHMs}
        fourHMs={fourHMs}
        candlesPaused={candlesPaused}
      />

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

        <SymbolColumn key={tab} symbol={symbol} markets={markets} />
      </div>
    </section>
  );
}
