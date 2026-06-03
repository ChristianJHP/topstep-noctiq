"use client";

import { useEffect, useMemo } from "react";
import useSWR from "swr";
import { useCountdownTick } from "@/hooks/use-countdown-tick";
import { BIAS_SUMMARY_REVALIDATE_SEC } from "@/lib/bias-summary-config";
import { BiasSummarySkeleton } from "@/components/radar/LiveSkeleton";
import type { RadarTab } from "@/components/radar/MarketBoard";

const DEFAULT_REVALIDATE_MS = BIAS_SUMMARY_REVALIDATE_SEC * 1000;

type SummaryPayload = {
  line: string | null;
  symbol?: string;
  generatedAt?: string;
  configured?: boolean;
  marketOpen?: boolean;
  revalidateSec?: number;
};

type StoredSummary = {
  fetchedAt: number;
  revalidateSec: number;
  data: SummaryPayload;
};

function storageKey(symbol: RadarTab) {
  return `jhp-instrument-bias-v1-${symbol}`;
}

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

function readStoredSummary(symbol: RadarTab): SummaryPayload | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(storageKey(symbol));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as StoredSummary;
    const ttl = parsed.revalidateSec * 1000;
    if (Date.now() - parsed.fetchedAt > ttl) return undefined;
    return parsed.data;
  } catch {
    return undefined;
  }
}

function writeStoredSummary(symbol: RadarTab, data: SummaryPayload) {
  if (typeof window === "undefined" || !data.line) return;
  try {
    localStorage.setItem(
      storageKey(symbol),
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

const SYMBOL_LABEL: Record<RadarTab, string> = {
  NQ: "NQ",
  ES: "ES",
  GC: "Gold",
};

export function InstrumentBiasSummary({ symbol }: { symbol: RadarTab }) {
  const stored = useMemo(() => readStoredSummary(symbol), [symbol]);
  const now = useCountdownTick(30_000);

  const { data, isLoading, isValidating } = useSWR<SummaryPayload>(
    `/api/bias/instrument-summary?symbol=${symbol}`,
    (url: string) => fetch(url).then((r) => r.json()),
    {
      fallbackData: stored,
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
    if (data?.line) writeStoredSummary(symbol, data);
  }, [data, symbol]);

  const refreshMeta = formatRefreshMeta(
    data?.generatedAt,
    now ?? Date.now(),
    revalidateMs(data)
  );

  const isRefreshing = isValidating && Boolean(data?.line);

  return (
    <section
      className={`bias-summary bias-summary--embedded live-enter${
        isRefreshing ? " bias-summary--refreshing" : ""
      }`}
      aria-live="polite"
    >
      <header className="bias-summary-head">
        <span className="bias-summary-label">
          {data?.marketOpen === false ? "When open" : "Next few hours"} ·{" "}
          {SYMBOL_LABEL[symbol]}
        </span>
        {refreshMeta ? (
          <span className="bias-summary-timing">{refreshMeta}</span>
        ) : null}
      </header>
      {isLoading && !data?.line ? (
        <BiasSummarySkeleton />
      ) : data?.line ? (
        <p className="bias-summary-text live-text-in" key={data.line.slice(0, 24)}>
          {data.line}
        </p>
      ) : (
        <p className="bias-summary-text bias-summary-text--muted">
          Summary unavailable.
        </p>
      )}
    </section>
  );
}
