"use client";

import useSWR from "swr";
import { useMemo } from "react";
import type { ContextFeedRow, GeoHeadline, MarketNewsItem } from "@/lib/geopolitics-sources";
import {
  buildInstrumentContextFeed,
  type InstrumentNewsLabel,
} from "@/lib/instrument-news";

type GeoPayload = {
  feed?: MarketNewsItem[];
  headlines?: GeoHeadline[];
};

export function ContextFeed({ instrument }: { instrument: InstrumentNewsLabel }) {
  const { data, isLoading } = useSWR<GeoPayload>(
    "/api/bias/geopolitics",
    (url: string) => fetch(url).then((r) => r.json()),
    {
      refreshInterval: 60_000,
      revalidateOnFocus: true,
      dedupingInterval: 30_000,
    }
  );

  const rows = useMemo(() => {
    const feed = data?.feed ?? [];
    const headlines = data?.headlines ?? [];
    if (!feed.length && !headlines.length) return [];
    return buildInstrumentContextFeed(feed, headlines, instrument);
  }, [data?.feed, data?.headlines, instrument]);

  if (isLoading && rows.length === 0) {
    return (
      <section className="context-feed context-feed--loading" aria-label="Context feed">
        <p className="context-feed-muted">Loading catalysts…</p>
      </section>
    );
  }

  if (rows.length === 0) return null;

  return (
    <section className="context-feed" aria-label={`Top catalysts for ${instrument}`}>
      {rows.map((row: ContextFeedRow) => (
        <div key={`${row.category}-${row.text}`} className="context-feed-row">
          <span className={`context-feed-k context-feed-k--${row.category.toLowerCase()}`}>
            {row.category}
          </span>
          <div className="context-feed-copy">
            {row.link ? (
              <a
                href={row.link}
                target="_blank"
                rel="noopener noreferrer"
                className="context-feed-v context-feed-v--link"
              >
                {row.text}
              </a>
            ) : (
              <p className="context-feed-v">{row.text}</p>
            )}
            <p className="context-feed-why">Why it matters: {row.whyItMatters}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
