"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useCountdownTick } from "@/hooks/use-countdown-tick";
import { BIAS_SUMMARY_REVALIDATE_SEC } from "@/lib/bias-summary-config";
import type { BiasSummaryRows } from "@/lib/bias-summary";

const REVALIDATE_MS = BIAS_SUMMARY_REVALIDATE_SEC * 1000;
const STORAGE_KEY = "jhp-bias-summary-v2";

type SummaryPayload = {
  rows: BiasSummaryRows | null;
  generatedAt?: string;
  configured?: boolean;
  stale?: boolean;
  cached?: boolean;
};

type StoredSummary = {
  fetchedAt: number;
  data: SummaryPayload;
};

const ROW_LABELS: { key: keyof BiasSummaryRows; label: string }[] = [
  { key: "context", label: "Context" },
  { key: "location", label: "Location" },
  { key: "relativeStrength", label: "Relative strength" },
  { key: "watch", label: "Watch" },
  { key: "catalyst", label: "Catalyst" },
];

function formatTimeEt(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatRefreshMeta(generatedAt: string | undefined, now: number) {
  if (!generatedAt) return null;
  const generatedMs = new Date(generatedAt).getTime();
  if (Number.isNaN(generatedMs)) return null;

  const nextMs = generatedMs + REVALIDATE_MS;
  const at = formatTimeEt(generatedAt);

  if (now >= nextMs) {
    return `Done ${at} ET · updating…`;
  }

  const minsUntil = Math.max(1, Math.ceil((nextMs - now) / 60_000));
  return `Done ${at} ET · next in ${minsUntil}m`;
}

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
  if (typeof window === "undefined" || !data.rows) return;
  try {
    const stored: StoredSummary = { fetchedAt: Date.now(), data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    /* quota / private mode */
  }
}

export function BiasSummary() {
  const [initial] = useState(readStoredSummary);
  const now = useCountdownTick(30_000);

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
    if (data?.rows) writeStoredSummary(data);
  }, [data]);

  if (data?.configured === false) return null;

  const refreshMeta = formatRefreshMeta(data?.generatedAt, now);

  return (
    <section className="bias-summary radar-card" aria-live="polite">
      <header className="bias-summary-head">
        <span className="bias-summary-label">Read</span>
        {refreshMeta ? (
          <span className="bias-summary-timing">{refreshMeta}</span>
        ) : null}
      </header>
      {isLoading && !data?.rows ? (
        <p className="bias-summary-text bias-summary-text--muted">Loading…</p>
      ) : data?.rows ? (
        <dl className="bias-summary-rows">
          {ROW_LABELS.map(({ key, label }) => (
            <div key={key} className="bias-summary-row">
              <dt className="bias-summary-row-label">{label}</dt>
              <dd className="bias-summary-row-value">{data.rows![key]}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
