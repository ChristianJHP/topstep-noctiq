"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveQuote } from "@/lib/yahoo-live-quote";
import { MARKET_TICKERS } from "@/lib/chart-data";
import type { EconomicEvent } from "@/lib/events";
import {
  createLiveTracker,
  eventAlertKey,
  isQuoteFresh,
  isRedFolderMonitoringWindow,
  liveMoveHit,
  pollIntervalMs,
  RED_FOLDER_MONITOR_POST_MS,
  releaseMs,
  shouldTrackLiveMove,
  updateLiveTracker,
  type LiveMoveTracker,
  type RedFolderMoveHit,
} from "@/lib/red-folder-move";

export type RedFolderMoveAlert = {
  id: string;
  event: EconomicEvent;
  move: RedFolderMoveHit;
  at: number;
};

const FIRED_STORAGE_KEY = "jhptrades-red-folder-fired";
const WATCH_HORIZON_MS = 24 * 60 * 60 * 1000;

function readFiredKeys(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(FIRED_STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeFiredKeys(keys: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const kept = [...keys].filter((k) => {
      const iso = k.split("|").slice(-1)[0];
      const t = Date.parse(iso);
      return Number.isFinite(t) && t > cutoff;
    });
    localStorage.setItem(FIRED_STORAGE_KEY, JSON.stringify(kept));
  } catch {
    /* ignore */
  }
}

function fireBrowserNotification(alert: RedFolderMoveAlert) {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return;
  }
  if (Notification.permission !== "granted") return;

  const delaySec = Math.round(alert.move.delayMs / 1000);
  try {
    new Notification(`Red folder · ${alert.event.title}`, {
      body: `NQ ${alert.move.rangePts}pt move · ${delaySec}s after release`,
      icon: "/icon.svg",
      tag: `red-folder-move-${eventAlertKey(alert.event)}`,
    });
  } catch {
    /* restricted contexts */
  }
}

async function fetchLiveNqQuote(): Promise<LiveQuote | null> {
  const url = `/api/quote?ticker=${encodeURIComponent(MARKET_TICKERS.NQ)}&_=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as LiveQuote;
}

export function useRedFolderMoveAlerts(events: EconomicEvent[]) {
  const [alerts, setAlerts] = useState<RedFolderMoveAlert[]>([]);
  const watchRef = useRef<Map<string, EconomicEvent>>(new Map());
  const trackerRef = useRef<Map<string, LiveMoveTracker>>(new Map());
  const firedRef = useRef<Set<string>>(readFiredKeys());
  const pollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const now = Date.now();
    for (const event of events) {
      const t = releaseMs(event);
      if (t - now > WATCH_HORIZON_MS) continue;
      if (t + RED_FOLDER_MONITOR_POST_MS < now) continue;
      watchRef.current.set(eventAlertKey(event), event);
    }

    for (const [key, event] of watchRef.current) {
      if (releaseMs(event) + RED_FOLDER_MONITOR_POST_MS < now) {
        watchRef.current.delete(key);
        trackerRef.current.delete(key);
      }
    }
  }, [events]);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (cancelled) return;

      const now = Date.now();
      const watching = [...watchRef.current.values()].filter((e) =>
        isRedFolderMonitoringWindow(e, now)
      );

      const interval = pollIntervalMs(watching, now);
      if (pollTimerRef.current != null) {
        window.clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }

      if (interval == null) {
        pollTimerRef.current = window.setTimeout(tick, 10_000);
        return;
      }

      if (watching.some((e) => shouldTrackLiveMove(e, now))) {
        const quote = await fetchLiveNqQuote();
        if (!cancelled && quote && isQuoteFresh(quote.quoteTime, now)) {
          for (const event of watching) {
            if (!shouldTrackLiveMove(event, now)) continue;

            const key = eventAlertKey(event);
            if (firedRef.current.has(key)) continue;

            let tracker = trackerRef.current.get(key);
            if (!tracker) {
              tracker = createLiveTracker();
              trackerRef.current.set(key, tracker);
            }

            updateLiveTracker(
              tracker,
              quote.price,
              quote.bar?.high,
              quote.bar?.low,
              now
            );

            const move = liveMoveHit(event, tracker, now);
            if (!move) continue;

            firedRef.current.add(key);
            writeFiredKeys(firedRef.current);

            const alert: RedFolderMoveAlert = {
              id: `rf-${key}-${now}`,
              event,
              move,
              at: now,
            };

            setAlerts((prev) => [...prev.slice(-1), alert]);
            fireBrowserNotification(alert);
          }
        }
      }

      pollTimerRef.current = window.setTimeout(tick, interval);
    }

    tick();

    return () => {
      cancelled = true;
      if (pollTimerRef.current != null) {
        window.clearTimeout(pollTimerRef.current);
      }
    };
  }, [events]);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return {
    alerts,
    dismissAlert,
  };
}
