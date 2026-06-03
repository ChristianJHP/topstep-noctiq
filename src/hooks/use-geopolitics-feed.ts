"use client";

import useSWR from "swr";
import type { GeoHeadline, MarketNewsItem } from "@/lib/geopolitics-sources";
import { usePageVisible } from "@/hooks/use-page-visible";
import { isFuturesSessionOpen } from "@/lib/futures-session";
import { LIVE_NEWS_REFRESH_MS } from "@/lib/bias-summary-config";

export type GeopoliticsFeedPayload = {
  feed?: MarketNewsItem[];
  headlines?: GeoHeadline[];
};

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("geopolitics fetch failed");
    return r.json() as Promise<GeopoliticsFeedPayload>;
  });

/** One shared poll for catalyst + news — avoids duplicate /api/bias/geopolitics requests. */
export function useGeopoliticsFeed() {
  const pageVisible = usePageVisible();
  const fast = pageVisible && isFuturesSessionOpen();

  const swr = useSWR<GeopoliticsFeedPayload>("/api/bias/geopolitics", fetcher, {
    refreshInterval: fast ? LIVE_NEWS_REFRESH_MS : 0,
    revalidateOnFocus: fast,
    dedupingInterval: fast ? 15_000 : 30_000,
    keepPreviousData: true,
  });

  return {
    feed: swr.data?.feed ?? [],
    headlines: swr.data?.headlines ?? [],
    isLoading: swr.isLoading && !swr.data?.feed?.length,
    isValidating: swr.isValidating,
  };
}
