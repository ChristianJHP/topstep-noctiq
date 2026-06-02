"use client";

import { useMemo, useState } from "react";
import {
  filterNewsForInstrument,
  instrumentNewsSubtitle,
  type InstrumentNewsLabel,
} from "@/lib/instrument-news";
import { useGeopoliticsFeed } from "@/hooks/use-geopolitics-feed";

const VISIBLE = 3;

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function labelClass(label: string): string {
  switch (label) {
    case "MUST KNOW":
      return "news-feed-tag--must-know";
    case "HIGH IMPACT":
      return "news-feed-tag--high-impact";
    case "GEO":
      return "news-feed-tag--geo";
    case "MACRO":
      return "news-feed-tag--macro";
    case "EARNINGS":
      return "news-feed-tag--earnings";
    case "DATA":
      return "news-feed-tag--data";
    default:
      return "news-feed-tag--watch";
  }
}

export function MarketNewsFeed({ instrument }: { instrument: InstrumentNewsLabel }) {
  const [expanded, setExpanded] = useState(false);
  const { feed: rawFeed, isLoading } = useGeopoliticsFeed();

  const feed = useMemo(
    () => filterNewsForInstrument(rawFeed, instrument, 10),
    [rawFeed, instrument]
  );

  const visible = expanded ? feed : feed.slice(0, VISIBLE);
  const hiddenCount = Math.max(0, feed.length - VISIBLE);

  if (isLoading && feed.length === 0) {
    return (
      <section
        className="news-feed news-feed--loading news-feed--placeholder"
        aria-label="Market news"
        aria-busy="true"
      />
    );
  }

  if (feed.length === 0) {
    return (
      <section className="news-feed news-feed--compact" aria-label="Market news">
        <header className="news-feed-head">
          <h2 className="news-feed-title">News</h2>
          <span className="news-feed-sub">{instrumentNewsSubtitle(instrument)}</span>
        </header>
        <p className="news-feed-muted">
          Headlines unavailable — RSS may be blocked. Retry in a minute.
        </p>
      </section>
    );
  }

  return (
    <section className="news-feed news-feed--compact" aria-label="Market news">
      <header className="news-feed-head">
        <h2 className="news-feed-title">News</h2>
        <span className="news-feed-sub">{instrumentNewsSubtitle(instrument)}</span>
      </header>
      <ul className="news-feed-list">
        {visible.map((item) => (
          <li key={item.id} className="news-feed-row">
            <div className="news-feed-tags">
              <span className={`news-feed-tag ${labelClass(item.label)}`}>
                {item.label}
              </span>
              {item.topics.map((topic) => (
                <span key={topic} className="news-feed-topic">
                  {topic}
                </span>
              ))}
            </div>
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
      {hiddenCount > 0 ? (
        <button
          type="button"
          className="news-feed-more"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? "Show less" : `Show ${hiddenCount} more`}
        </button>
      ) : null}
    </section>
  );
}
