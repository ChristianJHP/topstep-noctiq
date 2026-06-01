"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { candleSymbolBias, type MarketContext } from "@/lib/htf-status";
import type { HtfBias, SymbolLabel } from "@/lib/strategy-prep";

export type BiasShiftItem = {
  symbol: SymbolLabel;
  from: HtfBias;
  to: HtfBias;
};

export type BiasShiftAlert = {
  id: string;
  shifts: BiasShiftItem[];
  at: number;
};

const BIAS_STORAGE_KEY = "jhptrades-bias-snapshot";
const ALERTS_ENABLED_KEY = "jhptrades-bias-alerts-enabled";
const SYMBOLS: SymbolLabel[] = ["NQ", "ES", "GC"];

function biasLabel(b: HtfBias): string {
  if (b === "bullish") return "BULL";
  if (b === "bearish") return "BEAR";
  return "MIX";
}

export function formatBiasShiftTitle(alert: BiasShiftAlert): string {
  if (alert.shifts.length === 1) {
    const s = alert.shifts[0];
    return `${s.symbol} bias → ${biasLabel(s.to)}`;
  }
  return "Bias shifts";
}

export function formatBiasShiftBody(alert: BiasShiftAlert): string {
  return alert.shifts
    .map((s) => `${s.symbol} ${biasLabel(s.from)} → ${biasLabel(s.to)}`)
    .join(" · ");
}

function dominantBias(shifts: BiasShiftItem[]): HtfBias {
  if (shifts.length === 1) return shifts[0].to;
  const bears = shifts.filter((s) => s.to === "bearish").length;
  const bulls = shifts.filter((s) => s.to === "bullish").length;
  if (bears > bulls) return "bearish";
  if (bulls > bears) return "bullish";
  return "mixed";
}

export function alertTone(alert: BiasShiftAlert): HtfBias {
  return dominantBias(alert.shifts);
}

function extractBiases(
  markets: MarketContext
): Record<SymbolLabel, HtfBias> {
  return {
    NQ: candleSymbolBias(markets.nq),
    ES: candleSymbolBias(markets.es),
    GC: candleSymbolBias(markets.gold),
  };
}

function readStored(): Record<SymbolLabel, HtfBias> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BIAS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, HtfBias>;
    if (!parsed.NQ || !parsed.ES || !parsed.GC) return null;
    return parsed as Record<SymbolLabel, HtfBias>;
  } catch {
    return null;
  }
}

function writeStored(biases: Record<SymbolLabel, HtfBias>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BIAS_STORAGE_KEY, JSON.stringify(biases));
  } catch {
    /* ignore quota */
  }
}

function readAlertsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ALERTS_ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

function writeAlertsEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ALERTS_ENABLED_KEY, String(enabled));
  } catch {
    /* ignore quota */
  }
}

function fireBrowserNotification(alert: BiasShiftAlert) {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return;
  }
  if (Notification.permission !== "granted") return;

  try {
    new Notification(formatBiasShiftTitle(alert), {
      body: formatBiasShiftBody(alert),
      icon: "/icon.svg",
      tag: "bias-shift-batch",
    });
  } catch {
    /* Safari / restricted contexts */
  }
}

export function useBiasShiftAlerts(markets: MarketContext | null | undefined) {
  const [alerts, setAlerts] = useState<BiasShiftAlert[]>([]);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [notifyPermission, setNotifyPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const prevRef = useRef<Record<SymbolLabel, HtfBias> | null>(null);
  const seededRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setAlertsEnabled(readAlertsEnabled());
    if (typeof Notification === "undefined") {
      setNotifyPermission("unsupported");
      return;
    }
    setNotifyPermission(Notification.permission);
  }, []);

  const pushGroupedAlert = useCallback(
    (shifts: BiasShiftItem[]) => {
      if (shifts.length === 0 || !readAlertsEnabled()) return;

      const alert: BiasShiftAlert = {
        id: `batch-${Date.now()}`,
        shifts,
        at: Date.now(),
      };

      setAlerts((prev) => [...prev.slice(-2), alert]);
      fireBrowserNotification(alert);
    },
    []
  );

  useEffect(() => {
    if (!markets) return;

    const current = extractBiases(markets);
    const baseline = seededRef.current ? prevRef.current : readStored();

    if (baseline) {
      const shifts: BiasShiftItem[] = [];
      for (const symbol of SYMBOLS) {
        if (baseline[symbol] !== current[symbol]) {
          shifts.push({
            symbol,
            from: baseline[symbol],
            to: current[symbol],
          });
        }
      }
      if (shifts.length > 0) {
        pushGroupedAlert(shifts);
      }
    }

    prevRef.current = current;
    writeStored(current);
    seededRef.current = true;
  }, [markets, pushGroupedAlert]);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const enableAlerts = useCallback(async () => {
    writeAlertsEnabled(true);
    setAlertsEnabled(true);

    if (typeof window === "undefined" || typeof Notification === "undefined") {
      return true;
    }
    if (Notification.permission === "granted") {
      setNotifyPermission("granted");
      return true;
    }
    if (Notification.permission === "denied") {
      setNotifyPermission("denied");
      return true;
    }
    const result = await Notification.requestPermission();
    setNotifyPermission(result);
    return true;
  }, []);

  const disableAlerts = useCallback(() => {
    writeAlertsEnabled(false);
    setAlertsEnabled(false);
    setAlerts([]);
  }, []);

  return {
    alerts,
    alertsEnabled,
    dismissAlert,
    notifyPermission,
    enableAlerts,
    disableAlerts,
  };
}
