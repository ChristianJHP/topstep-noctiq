"use client";

import { useMemo } from "react";
import type { SymbolContext } from "@/lib/htf-status";
import { plotForTimeframe, type ChartTimeframe } from "@/lib/chart-timeframe";
import type { ChartOverlaySettings } from "@/lib/chart-overlay-types";
import { MiniSymbolChart } from "@/components/MiniSymbolChart";

export function SymbolChartPane({
  symbol,
  timeframe,
  overlays,
}: {
  symbol: SymbolContext;
  timeframe: ChartTimeframe;
  overlays: ChartOverlaySettings;
}) {
  const plot = useMemo(
    () => plotForTimeframe(symbol, timeframe),
    [symbol, timeframe]
  );

  return (
    <div className="sym-chart-pane">
      <div className="sym-chart-pane-head">
        <span className="sym-chart-pane-tf">{timeframe}</span>
      </div>
      <div className="sym-col-chart sym-col-chart--pane">
        <MiniSymbolChart
          ticker={symbol.ticker}
          plot={plot}
          timeframe={timeframe}
          overlays={overlays}
          currentPrice={symbol.current}
        />
      </div>
    </div>
  );
}
