"use client";

import useSWR from "swr";

type SummaryPayload = {
  summary: string | null;
  generatedAt?: string;
  configured?: boolean;
  stale?: boolean;
};

export function BiasSummary() {
  const { data, isLoading } = useSWR<SummaryPayload>(
    "/api/bias/summary",
    (url: string) => fetch(url).then((r) => r.json()),
    { refreshInterval: 20 * 60 * 1000, revalidateOnFocus: false }
  );

  if (data?.configured === false) return null;

  return (
    <section className="bias-summary radar-card" aria-live="polite">
      <header className="bias-summary-head">
        <span className="bias-summary-label">Read</span>
        {data?.stale ? (
          <span className="bias-summary-meta">cached</span>
        ) : null}
      </header>
      {isLoading && !data?.summary ? (
        <p className="bias-summary-text bias-summary-text--muted">Loading…</p>
      ) : data?.summary ? (
        <p className="bias-summary-text">{data.summary}</p>
      ) : null}
    </section>
  );
}
