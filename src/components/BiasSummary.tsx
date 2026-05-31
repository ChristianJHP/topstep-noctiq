"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { BIAS_SUMMARY_REVALIDATE_SEC } from "@/lib/bias-summary-config";

const REVALIDATE_MS = BIAS_SUMMARY_REVALIDATE_SEC * 1000;
const STORAGE_KEY = "jhp-bias-summary";

type SummaryPayload = {
  summary: string | null;
  generatedAt?: string;
  configured?: boolean;
  stale?: boolean;
  cached?: boolean;
};

type StoredSummary = {
  fetchedAt: number;
  data: SummaryPayload;
};

function readStoredSummary(): SummaryPayload | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as StoredSummary;
    if (Date.now() - parsed.fetchedAt > REVALIDATE_MS) return undefined;
    return parsed.data;
  } catch {
    return undefined;
  }
}

function writeStoredSummary(data: SummaryPayload) {
  if (typeof window === "undefined" || !data.summary) return;
  try {
    const stored: StoredSummary = { fetchedAt: Date.now(), data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    /* quota / private mode */
  }
}

export function BiasSummary() {
  const [initial] = useState(readStoredSummary);

  const { data, isLoading } = useSWR<SummaryPayload>(
    "/api/bias/summary",
    (url: string) => fetch(url).then((r) => r.json()),
    {
      fallbackData: initial,
      refreshInterval: REVALIDATE_MS,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: REVALIDATE_MS,
      keepPreviousData: true,
    }
  );

  useEffect(() => {
    if (data?.summary) writeStoredSummary(data);
  }, [data]);

  if (data?.configured === false) return null;

  return (
    <section className="bias-summary radar-card" aria-live="polite">
      <header className="bias-summary-head">
        <span className="bias-summary-label">Read</span>
      </header>
      {isLoading && !data?.summary ? (
        <p className="bias-summary-text bias-summary-text--muted">Loading…</p>
      ) : data?.summary ? (
        <p className="bias-summary-text">{data.summary}</p>
      ) : null}
    </section>
  );
}
