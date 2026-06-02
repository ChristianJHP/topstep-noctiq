"use client";

import useSWR from "swr";
import type { LiveQuote } from "@/lib/yahoo-live-quote";
import { usePageVisible } from "@/hooks/use-page-visible";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("quote fetch failed");
    return r.json() as Promise<LiveQuote>;
  });

type UseLiveQuoteOptions = {
  refreshMs?: number;
};

/** Poll Yahoo 1m quote — pauses when the browser tab is hidden. */
export function useLiveQuote(
  ticker: string,
  { refreshMs = 15_000 }: UseLiveQuoteOptions = {}
): LiveQuote | null {
  const pageVisible = usePageVisible();

  const { data } = useSWR<LiveQuote>(
    `/api/quote?ticker=${encodeURIComponent(ticker)}`,
    fetcher,
    {
      refreshInterval: pageVisible ? refreshMs : 0,
      revalidateOnFocus: pageVisible,
      dedupingInterval: 10_000,
      keepPreviousData: true,
    }
  );

  if (data?.price && data.price > 0) return data;
  return null;
}
