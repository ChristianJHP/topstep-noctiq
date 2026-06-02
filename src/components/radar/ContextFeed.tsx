"use client";

import { useMemo } from "react";
import {
  buildInstrumentContextFeed,
  type InstrumentNewsLabel,
} from "@/lib/instrument-news";
import { useGeopoliticsFeed } from "@/hooks/use-geopolitics-feed";

export function ContextFeed({ instrument }: { instrument: InstrumentNewsLabel }) {
  const { feed, headlines, isLoading } = useGeopoliticsFeed();

  const rows = useMemo(
    () => buildInstrumentContextFeed(feed, headlines, instrument),
    [feed, headlines, instrument]
  );

  if (isLoading && rows.length === 0) {
    return (
      <section
        className="context-feed context-feed--loading context-feed--placeholder"
        aria-label="Context feed"
        aria-busy="true"
      />
    );
  }

  if (rows.length === 0) return null;

  return (
    <section className="context-feed" aria-label={`Top catalysts for ${instrument}`}>
      {rows.map((row) => (
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
