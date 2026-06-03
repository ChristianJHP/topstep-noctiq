"use client";

import { useEffect, useState, useMemo } from "react";
import type { MarketContext } from "@/lib/htf-status";
import { MARKET_TICKERS } from "@/lib/chart-data";
import { InstrumentBiasSummary } from "@/components/radar/InstrumentBiasSummary";
import { SymbolColumn } from "@/components/radar/SymbolColumn";
import { MarketNewsFeed } from "@/components/radar/MarketNewsFeed";
import { useInstrumentBiasSummary } from "@/hooks/use-instrument-bias-summary";
import { overlaysFromSummaryText } from "@/lib/summary-chart-overlays";
import { usePrefetchChartCandles } from "@/hooks/use-prefetch-chart-candles";
import { useWarmChartCache } from "@/hooks/use-warm-chart-cache";
import { useLiveQuote } from "@/hooks/use-live-quote";
import type { ChartCandlesPayload } from "@/lib/chart-candles-cache";

export type RadarTab = "NQ" | "ES" | "GC";

const TABS: { id: RadarTab; label: string }[] = [
  { id: "NQ", label: "NQ" },
  { id: "ES", label: "ES" },
  { id: "GC", label: "Gold" },
];

const ALL_TABS: RadarTab[] = ["NQ", "ES", "GC"];

function warmAllTabs(
  active: RadarTab,
  mounted: ReadonlySet<RadarTab>
): ReadonlySet<RadarTab> {
  if (mounted.size >= ALL_TABS.length) return mounted;
  const next = new Set(mounted);
  next.add(active);
  return next;
}

type MarketBoardProps = {
  markets: MarketContext;
  chartCandles?: Record<string, ChartCandlesPayload>;
};

function SymbolPanel({
  id,
  active,
  markets,
  liveQuote,
}: {
  id: RadarTab;
  active: boolean;
  markets: MarketContext;
  liveQuote: ReturnType<typeof useLiveQuote>;
}) {
  const summary = useInstrumentBiasSummary(id);
  const symbol =
    id === "NQ" ? markets.nq : id === "ES" ? markets.es : markets.gold;
  const summaryKey = summary.data?.generatedAt
    ? `${id}:${summary.data.generatedAt}`
    : null;
  const aiOverlays = useMemo(() => {
    if (summary.data?.overlays) return summary.data.overlays;
    if (summary.data?.line) return overlaysFromSummaryText(summary.data.line);
    return null;
  }, [summary.data?.overlays, summary.data?.line]);

  return (
    <div
      className={`mr-symbol-panel${active ? "" : " mr-symbol-panel--hidden"}`}
      role="tabpanel"
      aria-hidden={!active}
      hidden={!active}
    >
      <InstrumentBiasSummary
        symbol={id}
        data={summary.data}
        isLoading={summary.isLoading}
        isValidating={summary.isValidating}
      />
      <SymbolColumn
        symbol={symbol}
        liveQuote={liveQuote}
        visible={active}
        aiOverlays={aiOverlays}
        summaryKey={summaryKey}
        tradeMap={summary.data?.tradeMap}
      />
      <MarketNewsFeed
        instrument={id}
        newsImpact={summary.data?.tradeMap?.newsImpact}
        newsLine={summary.data?.tradeMap?.newsLine}
      />
    </div>
  );
}

export function MarketBoard({
  markets,
  chartCandles,
}: MarketBoardProps) {
  const [tab, setTab] = useState<RadarTab>("NQ");
  const [mountedTabs, setMountedTabs] = useState<ReadonlySet<RadarTab>>(
    () => new Set(["NQ"])
  );

  usePrefetchChartCandles(chartCandles);
  useWarmChartCache();

  useEffect(() => {
    setMountedTabs((prev) => warmAllTabs(tab, prev));
  }, [tab]);

  useEffect(() => {
    const warm = () => setMountedTabs(new Set(ALL_TABS));
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(warm, { timeout: 1500 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(warm, 500);
    return () => window.clearTimeout(t);
  }, []);

  const nqQuote = useLiveQuote(MARKET_TICKERS.NQ);
  const esQuote = useLiveQuote(MARKET_TICKERS.ES);
  const gcQuote = useLiveQuote(MARKET_TICKERS.GC);

  const quoteForTab = (id: RadarTab) =>
    id === "NQ" ? nqQuote : id === "ES" ? esQuote : gcQuote;

  return (
    <section className="mr-board live-enter">
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

      <div className="mr-symbol-stacks">
        {ALL_TABS.map((id) => {
          if (!mountedTabs.has(id)) return null;
          return (
            <SymbolPanel
              key={id}
              id={id}
              active={tab === id}
              markets={markets}
              liveQuote={quoteForTab(id)}
            />
          );
        })}
      </div>
    </section>
  );
}
