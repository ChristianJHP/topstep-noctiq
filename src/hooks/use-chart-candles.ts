"use client";

import { useEffect, useMemo } from "react";
import useSWR from "swr";
import type { Candle } from "@/lib/chart-data";
import { CHART_CANDLES_REVALIDATE_OPEN_SEC } from "@/lib/chart-cache-config";
import {
  chartCandlesSwrKey,
  type ChartCandlesPayload,
} from "@/lib/chart-candles-cache";
import { usePageVisible } from "@/hooks/use-page-visible";

const STORAGE_PREFIX = "jhp-chart-v1";

type StoredChart = {
  fetchedAt: number;
  revalidateSec: number;
  data: ChartCandlesPayload;
};

function storageKey(swrKey: string): string {
  return `${STORAGE_PREFIX}:${swrKey}`;
}

function readLocal(swrKey: string): ChartCandlesPayload | undefined {
  try {
    const raw = localStorage.getItem(storageKey(swrKey));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as StoredChart;
    const ttl = parsed.revalidateSec * 1000;
    if (Date.now() - parsed.fetchedAt > ttl) return undefined;
    return parsed.data;
  } catch {
    return undefined;
  }
}

function writeLocal(swrKey: string, data: ChartCandlesPayload) {
  if (!data.candles.length) return;
  try {
    const stored: StoredChart = {
      fetchedAt: Date.now(),
      revalidateSec: data.revalidateSec,
      data,
    };
    localStorage.setItem(storageKey(swrKey), JSON.stringify(stored));
  } catch {
    /* quota or private mode */
  }
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("chart fetch failed");
    return r.json() as Promise<ChartCandlesPayload>;
  });

export function useChartCandles(
  ticker: string,
  interval: string,
  range: string,
  refreshCapMs?: number
) {
  const pageVisible = usePageVisible();
  const swrKey = chartCandlesSwrKey(ticker, interval, range);
  const localFallback = useMemo(() => readLocal(swrKey), [swrKey]);

  const swr = useSWR<ChartCandlesPayload>(swrKey, fetcher, {
    fallbackData: localFallback,
    dedupingInterval: CHART_CANDLES_REVALIDATE_OPEN_SEC * 1000,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    keepPreviousData: true,
    refreshInterval: (latest) => {
      if (!pageVisible) return 0;
      const base =
        (latest?.revalidateSec ?? CHART_CANDLES_REVALIDATE_OPEN_SEC) * 1000;
      if (refreshCapMs != null) return Math.min(base, refreshCapMs);
      return base;
    },
  });

  useEffect(() => {
    if (swr.data?.candles.length) {
      writeLocal(swrKey, swr.data);
    }
  }, [swr.data, swrKey]);

  return {
    candles: swr.data?.candles ?? [],
    isLoading: swr.isLoading && !swr.data?.candles.length,
    isValidating: swr.isValidating,
    error: swr.error,
  };
}

export type { Candle };
