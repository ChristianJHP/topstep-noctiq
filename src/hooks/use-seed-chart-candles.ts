"use client";

import { useLayoutEffect } from "react";
import { useSWRConfig } from "swr";
import type { ChartCandlesPayload } from "@/lib/chart-candles-cache";
import { seedKeyFromCacheKey } from "@/lib/chart-candles-cache";

/** Seed SWR from /api/radar chartCandles bundle — no extra network round-trips. */
export function useSeedChartCandles(
  chartCandles: Record<string, ChartCandlesPayload> | undefined
) {
  const { mutate } = useSWRConfig();

  useLayoutEffect(() => {
    if (!chartCandles) return;

    for (const [cacheKey, payload] of Object.entries(chartCandles)) {
      const swrKey = seedKeyFromCacheKey(cacheKey);
      if (!swrKey || !payload.candles.length) continue;
      mutate(swrKey, payload, { revalidate: false });
    }
  }, [chartCandles, mutate]);
}
