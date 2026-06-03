"use client";

import { useEffect } from "react";
import { preload, useSWRConfig } from "swr";
import { MARKET_TICKERS } from "@/lib/chart-data";
import {
  CHART_PREFETCH_SPECS,
  chartCandlesSwrKey,
  type ChartCandlesPayload,
} from "@/lib/chart-candles-cache";

const TICKERS = Object.values(MARKET_TICKERS);

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("chart warm failed");
    return r.json() as Promise<ChartCandlesPayload>;
  });

function hasCachedCandles(
  cache: ReturnType<typeof useSWRConfig>["cache"],
  key: string
): boolean {
  const entry = cache.get(key);
  const data = entry?.data as ChartCandlesPayload | undefined;
  return Boolean(data?.candles?.length);
}

/** Preload every ticker × interval into SWR so tab/timeframe switches are instant. */
export function useWarmChartCache() {
  const { cache } = useSWRConfig();

  useEffect(() => {
    const keys = TICKERS.flatMap((ticker) =>
      CHART_PREFETCH_SPECS.map((spec) =>
        chartCandlesSwrKey(ticker, spec.interval, spec.range)
      )
    );

    const warm = () => {
      for (const key of keys) {
        if (hasCachedCandles(cache, key)) continue;
        void preload(key, fetcher);
      }
    };

    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(warm, { timeout: 800 });
      return () => cancelIdleCallback(id);
    }

    const t = window.setTimeout(warm, 200);
    return () => window.clearTimeout(t);
  }, [cache]);
}
