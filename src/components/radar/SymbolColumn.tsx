"use client";

import { useEffect, useState } from "react";
import type { SymbolContext } from "@/lib/htf-status";
import { CHART_TIMEFRAMES, type ChartTimeframe } from "@/lib/chart-timeframe";
import type { LiveQuote } from "@/lib/yahoo-live-quote";
import { SymbolPrice } from "@/components/radar/SymbolPrice";
import { useChartOverlaySettings } from "@/lib/chart-overlay-settings";
import { CandleStateDots } from "@/components/radar/CandleStateDots";
import { ChartOverlayToggles } from "@/components/radar/ChartOverlayToggles";
import { SymbolChartPane } from "@/components/radar/SymbolChartPane";
import { useIsWideDesktop } from "@/hooks/use-is-wide-desktop";

function warmAllTimeframes(
  active: ChartTimeframe,
  mounted: ReadonlySet<ChartTimeframe>
): ReadonlySet<ChartTimeframe> {
  if (mounted.size >= CHART_TIMEFRAMES.length) return mounted;
  const next = new Set(mounted);
  next.add(active);
  return next;
}

export function SymbolColumn({
  symbol,
  liveQuote,
  visible = true,
}: {
  symbol: SymbolContext;
  liveQuote?: LiveQuote | null;
  visible?: boolean;
}) {
  const isWide = useIsWideDesktop();
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("1H");
  const [mountedTfs, setMountedTfs] = useState<ReadonlySet<ChartTimeframe>>(
    () => new Set(["1H"])
  );
  const { settings: overlays, toggle } = useChartOverlaySettings();

  useEffect(() => {
    setMountedTfs((prev) => warmAllTimeframes(timeframe, prev));
  }, [timeframe]);

  useEffect(() => {
    if (isWide) {
      setMountedTfs(new Set(CHART_TIMEFRAMES));
      return;
    }

    const warm = () => setMountedTfs(new Set(CHART_TIMEFRAMES));
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(warm, { timeout: 1200 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(warm, 300);
    return () => window.clearTimeout(t);
  }, [isWide]);

  return (
    <div className={`sym-col sym-col--solo${isWide ? " sym-col--wide" : ""}`}>
      <div className="sym-col-top">
        <CandleStateDots fourHour={symbol.fourHour} oneHour={symbol.oneHour} />
        <SymbolPrice symbol={symbol} liveQuote={liveQuote} />
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
              liveQuote={liveQuote}
              visible={visible}
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

          <div className="sym-tf-stacks">
            {CHART_TIMEFRAMES.map((tf) => {
              if (!mountedTfs.has(tf)) return null;
              const active = timeframe === tf;
              return (
                <div
                  key={tf}
                  className={`sym-tf-panel${active ? "" : " sym-tf-panel--hidden"}`}
                  role="tabpanel"
                  aria-hidden={!active}
                  hidden={!active}
                >
                  <SymbolChartPane
                    symbol={symbol}
                    timeframe={tf}
                    overlays={overlays}
                    liveQuote={liveQuote}
                    visible={visible && active}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}

    </div>
  );
}
