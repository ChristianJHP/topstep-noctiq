"use client";

import useSWR from "swr";
import type { HeadlinesPayload } from "@/lib/headlines";

function formatPublishedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const now = new Date();
  const etToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(now);
  const etHeadline = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(date);

  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  if (etHeadline === etToday) return `Today · ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const etYesterday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(yesterday);
  if (etHeadline === etYesterday) return `Yesterday · ${time}`;

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  }).format(date);

  return `${dateLabel} · ${time}`;
}

export function MarketMovingHeadlines() {
  const { data, error, isLoading, mutate } = useSWR<HeadlinesPayload>(
    "/api/headlines",
    async (url: string) => {
      const res = await fetch(url);
      const json = (await res.json()) as HeadlinesPayload & { error?: string };
      if (!res.ok && !json.marketMoving?.length) {
        throw new Error(json.error ?? "Failed to load");
      }
      return json;
    },
    { refreshInterval: 120_000 }
  );

  const headlines = data?.marketMoving ?? [];

  if (isLoading) {
    return <p className="text-xs text-[var(--muted)]">Scanning…</p>;
  }

  if (error && headlines.length === 0) {
    return (
      <div className="text-xs text-[var(--muted)]">
        <p>Unavailable.</p>
        <button
          type="button"
          onClick={() => mutate()}
          className="mt-1 text-[var(--accent)] underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (headlines.length === 0) {
    return (
      <p className="text-xs text-[var(--muted)]">
        No market-moving headlines right now.
      </p>
    );
  }

  return (
    <ul className="moving-headlines-list">
      {headlines.map((h) => (
        <li
          key={h.link}
          className={`moving-headlines-row moving-headlines-row--${h.priority}`}
        >
          <a
            href={h.link}
            target="_blank"
            rel="noopener noreferrer"
            className="moving-headlines-link"
          >
            {h.title}
          </a>
          <div className="moving-headlines-meta">
            <span className="moving-headlines-tag">
              {h.priority === "critical" ? "Critical" : "Macro"}
            </span>
            <time dateTime={h.publishedAt}>{formatPublishedAt(h.publishedAt)}</time>
          </div>
        </li>
      ))}
    </ul>
  );
}
