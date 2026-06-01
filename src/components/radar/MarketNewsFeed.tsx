"use client";

import useSWR from "swr";
import { GEO_BRIEF_REVALIDATE_SEC } from "@/lib/geopolitics-brief";
import type { MarketNewsItem } from "@/lib/geopolitics-sources";

type GeoPayload = {
  feed?: MarketNewsItem[];
  revalidateSec?: number;
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const now = new Date();
  const etToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(now);
  const etItem = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(date);

  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  if (etItem === etToday) return time;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const etYesterday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(yesterday);
  if (etItem === etYesterday) return `Yday ${time}`;

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function MarketNewsFeed() {
  const { data, isLoading } = useSWR<GeoPayload>(
    "/api/bias/geopolitics",
    (url: string) => fetch(url).then((r) => r.json()),
    {
      refreshInterval: (latest) =>
        (latest?.revalidateSec ?? GEO_BRIEF_REVALIDATE_SEC) * 1000,
      revalidateOnFocus: false,
      dedupingInterval: GEO_BRIEF_REVALIDATE_SEC * 1000,
    }
  );

  const feed = data?.feed ?? [];

  if (isLoading && feed.length === 0) {
    return (
      <section className="news-feed news-feed--loading" aria-label="Market news">
        <p className="news-feed-muted">Scanning war &amp; Trump headlines…</p>
      </section>
    );
  }

  if (feed.length === 0) {
    return (
      <section className="news-feed" aria-label="Market news">
        <header className="news-feed-head">
          <h2 className="news-feed-title">News</h2>
          <span className="news-feed-sub">NQ · ES · Gold</span>
        </header>
        <p className="news-feed-muted">No war or Trump headlines in feed right now.</p>
      </section>
    );
  }

  return (
    <section className="news-feed" aria-label="Market news">
      <header className="news-feed-head">
        <h2 className="news-feed-title">News</h2>
        <span className="news-feed-sub">War &amp; Trump · NQ · ES · Gold</span>
      </header>
      <ul className="news-feed-list">
        {feed.map((item) => (
          <li key={item.id} className={`news-feed-row news-feed-row--${item.kind}`}>
            <span className={`news-feed-tag news-feed-tag--${item.kind}`}>
              {item.kind === "trump" ? "Trump" : "War"}
            </span>
            {item.link ? (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="news-feed-text"
              >
                {item.text}
              </a>
            ) : (
              <p className="news-feed-text">{item.text}</p>
            )}
            <time className="news-feed-time" dateTime={item.publishedAt}>
              {formatTime(item.publishedAt)}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
}
