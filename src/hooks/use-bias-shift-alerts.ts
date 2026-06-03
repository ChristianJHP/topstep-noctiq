"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { candleSymbolBias, type MarketContext } from "@/lib/htf-status";
import {
  buildShiftSummaryContext,
  formatShiftSummaryDeterministic,
  type BiasShiftItem,
} from "@/lib/bias-shift-summary";
import type { HtfBias, SymbolLabel } from "@/lib/strategy-prep";
import type { AlertSettings } from "@/lib/alert-settings";
import { readAlertSettings } from "@/lib/alert-settings";
import {
  maybeFireBrowserNotification,
  maybePlayAlertSound,
} from "@/lib/alert-notify";

export type { BiasShiftItem };

export type BiasShiftAlert = {
  id: string;
  shifts: BiasShiftItem[];
  at: number;
  reason: string | null;
  reasonLoading: boolean;
};

const BIAS_STORAGE_KEY = "jhptrades-bias-snapshot";
const SYMBOLS: SymbolLabel[] = ["NQ", "ES", "GC"];

function contextLabel(b: HtfBias): string {
  if (b === "bullish") return "Bullish";
  if (b === "bearish") return "Bearish";
  return "Mixed";
}

export function formatBiasShiftTitle(alert: BiasShiftAlert): string {
  if (alert.shifts.length === 1) {
    const s = alert.shifts[0];
    return `${s.symbol} · ${contextLabel(s.to)} context`;
  }
  return "Context shifts";
}

export function formatBiasShiftTimestamp(at: number): string {
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(new Date(at)) + " ET"
  );
}

export function formatBiasShiftBody(alert: BiasShiftAlert): string {
  if (alert.reason) return alert.reason;
  if (alert.reasonLoading) return "…";
  return alert.shifts
    .map((s) => `${s.symbol} ${contextLabel(s.from)} → ${contextLabel(s.to)}`)
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

async function fetchShiftReason(
  markets: MarketContext,
  shifts: BiasShiftItem[]
): Promise<string> {
  const ctx = buildShiftSummaryContext(markets, shifts);
  const fallback = formatShiftSummaryDeterministic(ctx);

  try {
    const res = await fetch("/api/bias/shift-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ctx),
      cache: "no-store",
    });
    if (!res.ok) return fallback;
    const json = (await res.json()) as { line?: string | null };
    return json.line?.trim() || fallback;
  } catch {
    return fallback;
  }
}

export function useBiasShiftAlerts(
  markets: MarketContext | null | undefined,
  settings: AlertSettings
) {
  const [alerts, setAlerts] = useState<BiasShiftAlert[]>([]);
  const prevRef = useRef<Record<SymbolLabel, HtfBias> | null>(null);
  const seededRef = useRef(false);
  const marketsRef = useRef(markets);
  const settingsRef = useRef(settings);
  marketsRef.current = markets;
  settingsRef.current = settings;

  const attachReason = useCallback(
    (alertId: string, shifts: BiasShiftItem[]) => {
      const m = marketsRef.current;
      if (!m) {
        setAlerts((prev) =>
          prev.map((a) =>
            a.id === alertId ? { ...a, reasonLoading: false } : a
          )
        );
        return;
      }

      void fetchShiftReason(m, shifts).then((reason) => {
        setAlerts((prev) =>
          prev.map((a) =>
            a.id === alertId ? { ...a, reason, reasonLoading: false } : a
          )
        );

        const prefs = readAlertSettings();
        const alert: BiasShiftAlert = {
          id: alertId,
          shifts,
          at: Date.now(),
          reason,
          reasonLoading: false,
        };
        maybePlayAlertSound(prefs);
        maybeFireBrowserNotification(
          prefs,
          formatBiasShiftTitle(alert),
          `${formatBiasShiftTimestamp(alert.at)} · ${reason}`,
          "bias-shift-batch"
        );
      });
    },
    []
  );

  const pushGroupedAlert = useCallback(
    (shifts: BiasShiftItem[]) => {
      if (shifts.length === 0 || !settingsRef.current.biasShifts) return;

      const alert: BiasShiftAlert = {
        id: `batch-${Date.now()}`,
        shifts,
        at: Date.now(),
        reason: null,
        reasonLoading: true,
      };

      setAlerts((prev) => [...prev.slice(-2), alert]);
      attachReason(alert.id, shifts);
    },
    [attachReason]
  );

  useEffect(() => {
    if (!markets) return;

    const current = extractBiases(markets);
    const baseline = seededRef.current ? prevRef.current : readStored();

    if (baseline && settings.biasShifts) {
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
  }, [markets, settings.biasShifts, pushGroupedAlert]);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return {
    alerts,
    dismissAlert,
  };
}
