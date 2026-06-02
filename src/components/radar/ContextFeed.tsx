"use client";

import useSWR from "swr";
import type { ContextFeedRow } from "@/lib/geopolitics-sources";

type GeoPayload = {
  contextFeed?: ContextFeedRow[];
};

function FeedLink({
  row,
  className,
}: {
  row: ContextFeedRow;
  className: string;
}) {
  if (row.link) {
    return (
      <a
        href={row.link}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className} geo-v--link`}
        title="Open source"
      >
        {row.text}
      </a>
    );
  }
  return <p className={className}>{row.text}</p>;
}

export function ContextFeed() {
  const { data, isLoading } = useSWR<GeoPayload>(
    "/api/bias/geopolitics",
    (url: string) => fetch(url).then((r) => r.json()),
    {
      refreshInterval: 60_000,
      revalidateOnFocus: true,
      dedupingInterval: 30_000,
    }
  );

  const rows = data?.contextFeed ?? [];

  if (isLoading && rows.length === 0) {
    return (
      <section className="context-feed context-feed--loading" aria-label="Context feed">
        <p className="context-feed-muted">Loading context feed…</p>
      </section>
    );
  }

  if (rows.length === 0) return null;

  return (
    <section className="context-feed" aria-label="Context feed">
      {rows.map((row) => (
        <div key={`${row.category}-${row.text}`} className="context-feed-row">
          <span className={`context-feed-k context-feed-k--${row.category.toLowerCase()}`}>
            {row.category}
          </span>
          <FeedLink row={row} className="context-feed-v" />
        </div>
      ))}
    </section>
  );
}
