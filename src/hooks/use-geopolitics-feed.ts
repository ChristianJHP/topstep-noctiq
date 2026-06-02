"use client";

import useSWR from "swr";
import type { GeoHeadline, MarketNewsItem } from "@/lib/geopolitics-sources";
import { usePageVisible } from "@/hooks/use-page-visible";

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

  const swr = useSWR<GeopoliticsFeedPayload>("/api/bias/geopolitics", fetcher, {
    refreshInterval: pageVisible ? 60_000 : 0,
    revalidateOnFocus: pageVisible,
    dedupingInterval: 30_000,
    keepPreviousData: true,
  });

  return {
    feed: swr.data?.feed ?? [],
    headlines: swr.data?.headlines ?? [],
    isLoading: swr.isLoading && !swr.data?.feed?.length,
    isValidating: swr.isValidating,
  };
}
