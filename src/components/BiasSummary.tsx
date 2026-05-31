"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useCountdownTick } from "@/hooks/use-countdown-tick";
import { BIAS_SUMMARY_REVALIDATE_SEC } from "@/lib/bias-summary-config";

const DEFAULT_REVALIDATE_MS = BIAS_SUMMARY_REVALIDATE_SEC * 1000;
const STORAGE_KEY = "jhp-bias-summary-v5";

type SummaryPayload = {
  line: string | null;
  generatedAt?: string;
  configured?: boolean;
  cached?: boolean;
  marketOpen?: boolean;
  revalidateSec?: number;
};

type StoredSummary = {
  fetchedAt: number;
  revalidateSec: number;
  data: SummaryPayload;
};

function revalidateMs(data: SummaryPayload | undefined): number {
  return (data?.revalidateSec ?? BIAS_SUMMARY_REVALIDATE_SEC) * 1000;
}

function formatTimeEt(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatRefreshMeta(
  generatedAt: string | undefined,
  now: number,
  revalidateMsValue: number
) {
  if (!generatedAt) return null;
  const generatedMs = new Date(generatedAt).getTime();
  if (Number.isNaN(generatedMs)) return null;

  const nextMs = generatedMs + revalidateMsValue;
  const at = formatTimeEt(generatedAt);

  if (now >= nextMs) return `${at} ET · updating…`;

  const minsUntil = Math.max(1, Math.ceil((nextMs - now) / 60_000));
  return `${at} ET · refresh ${minsUntil}m`;
}

function readStoredSummary(): SummaryPayload | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as StoredSummary;
    const ttl = parsed.revalidateSec * 1000;
    if (Date.now() - parsed.fetchedAt > ttl) return undefined;
    return parsed.data;
  } catch {
    return undefined;
  }
}

function writeStoredSummary(data: SummaryPayload) {
  if (typeof window === "undefined" || !data.line) return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        fetchedAt: Date.now(),
        revalidateSec: data.revalidateSec ?? BIAS_SUMMARY_REVALIDATE_SEC,
        data,
      })
    );
  } catch {
    /* ignore */
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
      refreshInterval: (latest) =>
        latest?.revalidateSec
          ? latest.revalidateSec * 1000
          : DEFAULT_REVALIDATE_MS,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: DEFAULT_REVALIDATE_MS,
      keepPreviousData: true,
    }
  );

  useEffect(() => {
    if (data?.line) writeStoredSummary(data);
  }, [data]);

  const refreshMeta = formatRefreshMeta(
    data?.generatedAt,
    now,
    revalidateMs(data)
  );

  return (
    <section className="bias-summary radar-card" aria-live="polite">
      <header className="bias-summary-head">
        <span className="bias-summary-label">
          {data?.marketOpen === false ? "When open" : "Next hour"}
        </span>
        {refreshMeta ? (
          <span className="bias-summary-timing">{refreshMeta}</span>
        ) : null}
      </header>
      {isLoading && !data?.line ? (
        <p className="bias-summary-text bias-summary-text--muted">Loading…</p>
      ) : data?.line ? (
        <p className="bias-summary-text">{data.line}</p>
      ) : (
        <p className="bias-summary-text bias-summary-text--muted">
          Summary unavailable.
        </p>
      )}
    </section>
  );
}
