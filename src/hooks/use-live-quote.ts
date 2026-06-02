"use client";

import useSWR from "swr";
import type { LiveQuote } from "@/lib/yahoo-live-quote";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("quote fetch failed");
    return r.json() as Promise<LiveQuote>;
  });

/** Poll Yahoo 1m quote so header + forming candle stay near live. */
export function useLiveQuote(ticker: string): LiveQuote | null {
  const { data } = useSWR<LiveQuote>(
    `/api/quote?ticker=${encodeURIComponent(ticker)}`,
    fetcher,
    {
      refreshInterval: 15_000,
      revalidateOnFocus: true,
      dedupingInterval: 10_000,
    }
  );

  if (data?.price && data.price > 0) return data;
  return null;
}
