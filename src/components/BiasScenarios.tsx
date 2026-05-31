"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useCountdownTick } from "@/hooks/use-countdown-tick";
import { BIAS_SUMMARY_REVALIDATE_SEC } from "@/lib/bias-summary-config";
import type { BiasScenarios, ScenarioItem } from "@/lib/bias-scenarios";

const REVALIDATE_MS = BIAS_SUMMARY_REVALIDATE_SEC * 1000;
const STORAGE_KEY = "jhp-bias-scenarios-v1";

type ScenariosPayload = {
  scenarios: BiasScenarios | null;
  generatedAt?: string;
  configured?: boolean;
  cached?: boolean;
};

type StoredScenarios = {
  fetchedAt: number;
  data: ScenariosPayload;
};

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

  if (now >= nextMs) return `Done ${at} ET · updating…`;

  const minsUntil = Math.max(1, Math.ceil((nextMs - now) / 60_000));
  return `Done ${at} ET · next in ${minsUntil}m`;
}

function readStored(): ScenariosPayload | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as StoredScenarios;
    if (Date.now() - parsed.fetchedAt > REVALIDATE_MS) return undefined;
    return parsed.data;
  } catch {
    return undefined;
  }
}

function writeStored(data: ScenariosPayload) {
  if (typeof window === "undefined" || !data.scenarios) return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ fetchedAt: Date.now(), data })
    );
  } catch {
    /* ignore */
  }
}

function ScenarioList({
  title,
  items,
  tone,
}: {
  title: string;
  items: ScenarioItem[];
  tone: "bull" | "bear";
}) {
  return (
    <div className={`bias-scenarios-block bias-scenarios-block--${tone}`}>
      <h3 className="bias-scenarios-block-title">{title}</h3>
      <ul className="bias-scenarios-list">
        {items.map((item, i) => (
          <li key={`${title}-${i}`} className="bias-scenarios-item">
            <span className="bias-scenarios-if">If {item.if}</span>
            <span className="bias-scenarios-then">→ {item.then}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BiasScenarios() {
  const [initial] = useState(readStored);
  const now = useCountdownTick(30_000);

  const { data, isLoading } = useSWR<ScenariosPayload>(
    "/api/bias/scenarios",
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
    if (data?.scenarios) writeStored(data);
  }, [data]);

  const refreshMeta = formatRefreshMeta(data?.generatedAt, now);
  const scenarios = data?.scenarios;

  return (
    <section className="bias-scenarios radar-card" aria-live="polite">
      <header className="bias-scenarios-head">
        <div>
          <span className="bias-scenarios-label">If / then scenarios</span>
          <p className="bias-scenarios-note">Speculative — not a trade call</p>
        </div>
        {refreshMeta ? (
          <span className="bias-scenarios-timing">{refreshMeta}</span>
        ) : null}
      </header>

      {isLoading && !scenarios ? (
        <p className="bias-scenarios-loading">Loading…</p>
      ) : scenarios ? (
        <div className="bias-scenarios-body">
          <ScenarioList
            title="Bullish if"
            items={scenarios.bullish}
            tone="bull"
          />
          <ScenarioList
            title="Bearish if"
            items={scenarios.bearish}
            tone="bear"
          />
        </div>
      ) : null}
    </section>
  );
}
