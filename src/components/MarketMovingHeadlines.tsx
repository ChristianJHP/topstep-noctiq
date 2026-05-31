"use client";

import useSWR from "swr";
import type { HeadlinesPayload } from "@/lib/headlines";

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
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
            <time>{formatTime(h.publishedAt)}</time>
          </div>
        </li>
      ))}
    </ul>
  );
}
