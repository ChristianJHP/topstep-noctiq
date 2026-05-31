import type { Candle } from "@/lib/chart-data";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export function chartCacheKey(
  ticker: string,
  interval: string,
  range: string
): string {
  return `${ticker}|${interval}|${range}`;
}

type StoredRow = {
  cache_key: string;
  candles: Candle[];
  fetched_at: string;
};

export async function readChartCandlesFromStore(
  ticker: string,
  interval: string,
  range: string,
  maxAgeSec: number
): Promise<{ candles: Candle[]; fetchedAt: string } | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const cache_key = chartCacheKey(ticker, interval, range);

  try {
    const { data, error } = await supabase
      .from("chart_candles_cache")
      .select("cache_key, candles, fetched_at")
      .eq("cache_key", cache_key)
      .maybeSingle<StoredRow>();

    if (error || !data?.candles?.length) return null;

    const ageMs = Date.now() - new Date(data.fetched_at).getTime();
    if (ageMs > maxAgeSec * 1000) return null;

    return { candles: data.candles, fetchedAt: data.fetched_at };
  } catch (err) {
    console.error("[chart-store] read", err);
    return null;
  }
}

export async function writeChartCandlesToStore(
  ticker: string,
  interval: string,
  range: string,
  candles: Candle[]
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase || !candles.length) return;

  const cache_key = chartCacheKey(ticker, interval, range);
  const fetched_at = new Date().toISOString();

  try {
    const { error } = await supabase.from("chart_candles_cache").upsert(
      {
        cache_key,
        ticker,
        interval,
        range,
        candles,
        fetched_at,
      },
      { onConflict: "cache_key" }
    );

    if (error) console.error("[chart-store] write", error.message);
  } catch (err) {
    console.error("[chart-store] write", err);
  }
}
