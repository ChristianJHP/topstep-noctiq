"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getNextCandleClose,
  type CandleInterval,
} from "@/lib/candle-timers";
import type { AlertSettings } from "@/lib/alert-settings";
import { readAlertSettings } from "@/lib/alert-settings";
import {
  maybeFireBrowserNotification,
  maybePlayAlertSound,
} from "@/lib/alert-notify";

export type CandleCloseAlert = {
  id: string;
  interval: CandleInterval;
  at: number;
};

const INTERVALS: CandleInterval[] = ["15M", "1H", "4H"];

export function useCandleCloseAlerts(now: number, settings: AlertSettings) {
  const [alerts, setAlerts] = useState<CandleCloseAlert[]>([]);
  const prevRemainingRef = useRef<Partial<Record<CandleInterval, number>>>({});
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    const clock = new Date(now);

    for (const interval of INTERVALS) {
      if (!settings.candleClose[interval]) continue;

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

        const prefs = readAlertSettings();
        maybePlayAlertSound(prefs);
        maybeFireBrowserNotification(
          prefs,
          `${interval} candle closed`,
          "New bar — check bias and levels.",
          `candle-close-${interval}`
        );
      }

      prevRemainingRef.current[interval] = cd.remainingMs;
    }
  }, [now, settings.candleClose]);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((a) => a.filter((x) => x.id !== id));
  }, []);

  return {
    alerts,
    dismissAlert,
  };
}
