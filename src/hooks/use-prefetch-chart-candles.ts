"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { MARKET_TICKERS } from "@/lib/chart-data";
import {
  CHART_PREFETCH_SPECS,
  chartCacheKey,
  chartCandlesSwrKey,
  type ChartCandlesPayload,
} from "@/lib/chart-candles-cache";

const TICKERS = Object.values(MARKET_TICKERS);

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("chart prefetch failed");
    return r.json() as Promise<ChartCandlesPayload>;
  });

/** Fill chart keys missing from the radar bundle (fallback only). */
export function usePrefetchChartCandles(
  chartCandles?: Record<string, ChartCandlesPayload>
) {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    if (!chartCandles) return;

    for (const ticker of TICKERS) {
      for (const spec of CHART_PREFETCH_SPECS) {
        const id = chartCacheKey(ticker, spec.interval, spec.range);
        if (chartCandles[id]?.candles.length) continue;

        const key = chartCandlesSwrKey(ticker, spec.interval, spec.range);
        void fetcher(key).then((data) => {
          mutate(key, data, { revalidate: false });
        });
      }
    }
  }, [chartCandles, mutate]);
}
