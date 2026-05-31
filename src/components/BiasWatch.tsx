"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { BIAS_SUMMARY_REVALIDATE_SEC } from "@/lib/bias-summary-config";

const DEFAULT_REVALIDATE_MS = BIAS_SUMMARY_REVALIDATE_SEC * 1000;
const STORAGE_KEY = "jhp-bias-watch-v1";

type WatchPayload = {
  items: string[];
  generatedAt?: string;
  configured?: boolean;
  cached?: boolean;
  marketOpen?: boolean;
  revalidateSec?: number;
};

type StoredWatch = {
  fetchedAt: number;
  revalidateSec: number;
  data: WatchPayload;
};

function readStored(): WatchPayload | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as StoredWatch;
    const ttl = parsed.revalidateSec * 1000;
    if (Date.now() - parsed.fetchedAt > ttl) return undefined;
    return parsed.data;
  } catch {
    return undefined;
  }
}

function writeStored(data: WatchPayload) {
  if (!data.items.length) return;
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

export function BiasWatch({ embedded = false }: { embedded?: boolean }) {
  const [storedFallback, setStoredFallback] = useState<WatchPayload | undefined>(
    undefined
  );

  useEffect(() => {
    setStoredFallback(readStored());
  }, []);

  const { data, isLoading } = useSWR<WatchPayload>(
    "/api/bias/watch",
    (url: string) => fetch(url).then((r) => r.json()),
    {
      fallbackData: storedFallback,
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
    if (data?.items?.length) writeStored(data);
  }, [data]);

  const showLoading = isLoading && !data?.items?.length;

  return (
    <section
      className={
        embedded ? "bias-watch bias-watch--embedded" : "bias-watch radar-card"
      }
      aria-live="polite"
    >
      {showLoading ? (
        <p className="bias-watch-empty">Loading…</p>
      ) : data?.items?.length ? (
        <ul className="bias-watch-list">
          {data.items.map((item) => (
            <li key={item} className="bias-watch-item">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="bias-watch-empty">Nothing flagged right now.</p>
      )}
    </section>
  );
}
