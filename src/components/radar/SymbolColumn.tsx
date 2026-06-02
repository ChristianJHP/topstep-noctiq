"use client";

import { useState } from "react";
import type { SymbolContext } from "@/lib/htf-status";
import { CHART_TIMEFRAMES, type ChartTimeframe } from "@/lib/chart-timeframe";
import type { SymbolLabel } from "@/lib/strategy-prep";
import { SymbolPrice } from "@/components/radar/SymbolPrice";
import { useChartOverlaySettings } from "@/lib/chart-overlay-settings";
import { CandleStateDots } from "@/components/radar/CandleStateDots";
import { ChartOverlayToggles } from "@/components/radar/ChartOverlayToggles";
import { LevelsSummary } from "@/components/radar/LevelsSummary";
import { SymbolChartPane } from "@/components/radar/SymbolChartPane";
import { useIsWideDesktop } from "@/hooks/use-is-wide-desktop";
import { useLiveQuote } from "@/hooks/use-live-quote";

export function SymbolColumn({ symbol }: { symbol: SymbolContext }) {
  const isWide = useIsWideDesktop();
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("5m");
  const { settings: overlays, toggle } = useChartOverlaySettings();
  const label = symbol.label as SymbolLabel;
  const livePrice = useLiveQuote(symbol.ticker);

  return (
    <div className={`sym-col sym-col--solo${isWide ? " sym-col--wide" : ""}`}>
      <div className="sym-col-top">
        <CandleStateDots fourHour={symbol.fourHour} oneHour={symbol.oneHour} />
        <SymbolPrice symbol={symbol} livePrice={livePrice} />
      </div>

      <ChartOverlayToggles settings={overlays} onToggle={toggle} />

      {isWide ? (
        <div className="sym-col-charts-wide">
          {CHART_TIMEFRAMES.map((tf) => (
            <SymbolChartPane
              key={tf}
              symbol={symbol}
              timeframe={tf}
              overlays={overlays}
              livePrice={livePrice}
            />
          ))}
        </div>
      ) : (
        <>
          <div className="mr-tf-tabs" role="tablist" aria-label="Chart timeframe">
            {CHART_TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                role="tab"
                aria-selected={timeframe === tf}
                className={`mr-tf-tab${timeframe === tf ? " mr-tf-tab--active" : ""}`}
                onClick={() => setTimeframe(tf)}
              >
                {tf}
              </button>
            ))}
          </div>

          <SymbolChartPane
            symbol={symbol}
            timeframe={timeframe}
            overlays={overlays}
            livePrice={livePrice}
          />
        </>
      )}

      <LevelsSummary symbol={label} />
    </div>
  );
}
