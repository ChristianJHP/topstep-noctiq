import { unstable_cache } from "next/cache";
import { MARKET_TICKERS } from "@/lib/chart-data";
import { fetchCandles, type Candle } from "@/lib/chart-data";
import {
  CHART_CANDLES_REVALIDATE_CLOSED_SEC,
  CHART_CANDLES_REVALIDATE_OPEN_SEC,
} from "@/lib/chart-cache-config";
import {
  readChartCandlesFromStore,
  writeChartCandlesToStore,
  chartCacheKey,
} from "@/lib/chart-candles-store";
import { isFuturesSessionOpen } from "@/lib/futures-session";

export { chartCacheKey } from "@/lib/chart-candles-store";

export type ChartCandlesPayload = {
  candles: Candle[];
  fetchedAt: string;
  revalidateSec: number;
  source?: "yahoo" | "supabase" | "memory";
};

function revalidateSec(): number {
  return isFuturesSessionOpen()
    ? CHART_CANDLES_REVALIDATE_OPEN_SEC
    : CHART_CANDLES_REVALIDATE_CLOSED_SEC;
}

async function fetchFromYahoo(
  ticker: string,
  interval: string,
  range: string
): Promise<ChartCandlesPayload> {
  const candles = await fetchCandles(ticker, { interval, range });
  const fetchedAt = new Date().toISOString();
  const ttl = revalidateSec();

  void writeChartCandlesToStore(ticker, interval, range, candles);

  return {
    candles,
    fetchedAt,
    revalidateSec: ttl,
    source: "yahoo",
  };
}

async function loadCandlesUncached(
  ticker: string,
  interval: string,
  range: string
): Promise<ChartCandlesPayload> {
  const ttl = revalidateSec();

  const stored = await readChartCandlesFromStore(ticker, interval, range, ttl);
  if (stored) {
    return {
      candles: stored.candles,
      fetchedAt: stored.fetchedAt,
      revalidateSec: ttl,
      source: "supabase",
    };
  }

  return fetchFromYahoo(ticker, interval, range);
}

/** Bypass Next/supabase cache — for live 1m polls during news release. */
export async function fetchFreshChartCandles(
  ticker: string,
  interval: string,
  range: string
): Promise<ChartCandlesPayload> {
  return fetchFromYahoo(ticker, interval, range);
}

export async function getCachedChartCandles(
  ticker: string,
  interval: string,
  range: string
): Promise<ChartCandlesPayload> {
  const ttl = revalidateSec();
  const open = isFuturesSessionOpen();

  return unstable_cache(
    () => loadCandlesUncached(ticker, interval, range),
    ["chart-candles-v2", ticker, interval, range, open ? "open" : "closed"],
    {
      revalidate: ttl,
      tags: ["chart-candles", `chart-${ticker}`],
    }
  )();
}

export function chartCandlesSwrKey(
  ticker: string,
  interval: string,
  range: string
): string {
  const params = new URLSearchParams({ ticker, interval, range });
  return `/api/chart?${params.toString()}`;
}

/** One fetch serves both 1H and 4H charts. */
export const CHART_PREFETCH_SPECS = [
  { interval: "15m", range: "7d" },
  { interval: "60m", range: "3mo" },
] as const;

const TICKERS = Object.values(MARKET_TICKERS);

export async function loadAllChartCandles(): Promise<
  Record<string, ChartCandlesPayload>
> {
  const entries = await Promise.all(
    TICKERS.flatMap((ticker) =>
      CHART_PREFETCH_SPECS.map(async (spec) => {
        const payload = await getCachedChartCandles(
          ticker,
          spec.interval,
          spec.range
        );
        return [chartCacheKey(ticker, spec.interval, spec.range), payload] as const;
      })
    )
  );

  return Object.fromEntries(entries);
}

export function seedKeyFromCacheKey(cacheKey: string): string | null {
  const [ticker, interval, range] = cacheKey.split("|");
  if (!ticker || !interval || !range) return null;
  return chartCandlesSwrKey(ticker, interval, range);
}
