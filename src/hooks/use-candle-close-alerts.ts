"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getNextCandleClose,
  type CandleInterval,
} from "@/lib/candle-timers";

export type CandleCloseAlert = {
  id: string;
  interval: CandleInterval;
  at: number;
};

export type CandleAlertSettings = Record<CandleInterval, boolean>;

const STORAGE_KEY = "jhptrades-candle-close-alerts";

const DEFAULT_SETTINGS: CandleAlertSettings = {
  "15M": false,
  "1H": false,
  "4H": false,
};

const INTERVALS: CandleInterval[] = ["15M", "1H", "4H"];

function readSettings(): CandleAlertSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<CandleAlertSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeSettings(settings: CandleAlertSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

function fireBrowserNotification(interval: CandleInterval) {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return;
  }
  if (Notification.permission !== "granted") return;

  try {
    new Notification(`${interval} candle closed`, {
      body: "New bar — check bias and levels.",
      icon: "/icon.svg",
      tag: `candle-close-${interval}`,
    });
  } catch {
    /* restricted contexts */
  }
}

export function useCandleCloseAlerts(now: number) {
  const [settings, setSettings] = useState<CandleAlertSettings>(DEFAULT_SETTINGS);
  const [alerts, setAlerts] = useState<CandleCloseAlert[]>([]);
  const prevRemainingRef = useRef<Partial<Record<CandleInterval, number>>>({});

  useEffect(() => {
    setSettings(readSettings());
  }, []);

  useEffect(() => {
    const clock = new Date(now);

    for (const interval of INTERVALS) {
      if (!settings[interval]) continue;

      const cd = getNextCandleClose(interval, clock);
      if (cd.paused || cd.remainingMs == null) {
        prevRemainingRef.current[interval] = undefined;
        continue;
      }

      const prev = prevRemainingRef.current[interval];
      const jumped =
        prev != null && prev <= 2000 && cd.remainingMs > prev + 30_000;

      if (jumped) {
        const alert: CandleCloseAlert = {
          id: `${interval}-${now}`,
          interval,
          at: now,
        };
        setAlerts((a) => [...a.slice(-2), alert]);
        fireBrowserNotification(interval);
      }

      prevRemainingRef.current[interval] = cd.remainingMs;
    }
  }, [now, settings]);

  const toggle = useCallback(async (interval: CandleInterval) => {
    const current = readSettings();
    const next = { ...current, [interval]: !current[interval] };

    if (next[interval] && typeof Notification !== "undefined") {
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
    }

    writeSettings(next);
    setSettings(next);
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((a) => a.filter((x) => x.id !== id));
  }, []);

  return {
    settings,
    toggle,
    alerts,
    dismissAlert,
  };
}
