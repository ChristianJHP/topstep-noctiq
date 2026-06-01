"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { candleSymbolBias, type MarketContext } from "@/lib/htf-status";
import type { HtfBias, SymbolLabel } from "@/lib/strategy-prep";

export type BiasShiftAlert = {
  id: string;
  symbol: SymbolLabel;
  from: HtfBias;
  to: HtfBias;
  at: number;
};

const STORAGE_KEY = "jhptrades-bias-snapshot";
const SYMBOLS: SymbolLabel[] = ["NQ", "ES", "GC"];

function biasLabel(b: HtfBias): string {
  if (b === "bullish") return "BULL";
  if (b === "bearish") return "BEAR";
  return "MIX";
}

export function formatBiasShiftTitle(alert: BiasShiftAlert): string {
  return `${alert.symbol} bias → ${biasLabel(alert.to)}`;
}

export function formatBiasShiftBody(alert: BiasShiftAlert): string {
  return `${biasLabel(alert.from)} shifted to ${biasLabel(alert.to)} (4H + 1H candles)`;
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
    const raw = window.localStorage.getItem(STORAGE_KEY);
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(biases));
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
      tag: `bias-${alert.symbol}-${alert.to}`,
    });
  } catch {
    /* Safari / restricted contexts */
  }
}

export function useBiasShiftAlerts(markets: MarketContext | null | undefined) {
  const [alerts, setAlerts] = useState<BiasShiftAlert[]>([]);
  const [notifyPermission, setNotifyPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const prevRef = useRef<Record<SymbolLabel, HtfBias> | null>(null);
  const seededRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof Notification === "undefined") {
      setNotifyPermission("unsupported");
      return;
    }
    setNotifyPermission(Notification.permission);
  }, []);

  const pushAlert = useCallback((symbol: SymbolLabel, from: HtfBias, to: HtfBias) => {
    const alert: BiasShiftAlert = {
      id: `${symbol}-${from}-${to}-${Date.now()}`,
      symbol,
      from,
      to,
      at: Date.now(),
    };

    setAlerts((prev) => [...prev.slice(-4), alert]);
    fireBrowserNotification(alert);
  }, []);

  useEffect(() => {
    if (!markets) return;

    const current = extractBiases(markets);
    const baseline = seededRef.current ? prevRef.current : readStored();

    if (baseline) {
      for (const symbol of SYMBOLS) {
        if (baseline[symbol] !== current[symbol]) {
          pushAlert(symbol, baseline[symbol], current[symbol]);
        }
      }
    }

    prevRef.current = current;
    writeStored(current);
    seededRef.current = true;
  }, [markets, pushAlert]);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const requestNotifyPermission = useCallback(async () => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      return false;
    }
    if (Notification.permission === "granted") {
      setNotifyPermission("granted");
      return true;
    }
    if (Notification.permission === "denied") {
      setNotifyPermission("denied");
      return false;
    }
    const result = await Notification.requestPermission();
    setNotifyPermission(result);
    return result === "granted";
  }, []);

  return {
    alerts,
    dismissAlert,
    notifyPermission,
    requestNotifyPermission,
  };
}
