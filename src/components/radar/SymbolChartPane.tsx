import type { SymbolContext } from "@/lib/htf-status";
import { plotForTimeframe, type ChartTimeframe } from "@/lib/chart-timeframe";
import { MiniSymbolChart } from "@/components/MiniSymbolChart";

export function SymbolChartPane({
  symbol,
  timeframe,
}: {
  symbol: SymbolContext;
  timeframe: ChartTimeframe;
}) {
  const plot = plotForTimeframe(symbol, timeframe);

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
        />
      </div>
    </div>
  );
}
