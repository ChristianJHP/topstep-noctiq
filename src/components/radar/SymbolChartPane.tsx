"use client";

import { useMemo } from "react";
import type { SymbolContext } from "@/lib/htf-status";
import { plotForTimeframe, type ChartTimeframe } from "@/lib/chart-timeframe";
import type { ChartOverlaySettings } from "@/lib/chart-overlay-types";
import type { LiveQuote } from "@/lib/yahoo-live-quote";
import { MiniSymbolChart } from "@/components/MiniSymbolChart";

export function SymbolChartPane({
  symbol,
  timeframe,
  overlays,
  liveQuote,
}: {
  symbol: SymbolContext;
  timeframe: ChartTimeframe;
  overlays: ChartOverlaySettings;
  liveQuote?: LiveQuote | null;
}) {
  const plot = useMemo(
    () => plotForTimeframe(symbol, timeframe),
    [symbol, timeframe]
  );
  const currentPrice = liveQuote?.price ?? symbol.current;

  return (
    <div className="sym-chart-pane">
      <div className="sym-chart-pane-head">
        <span className="sym-chart-pane-tf">{timeframe}</span>
      </div>
      <div className="sym-col-chart sym-col-chart--pane">
        <MiniSymbolChart
          ticker={symbol.ticker}
          symbolLabel={symbol.label}
          plot={plot}
          timeframe={timeframe}
          overlays={overlays}
          currentPrice={currentPrice}
        />
      </div>
    </div>
  );
}
