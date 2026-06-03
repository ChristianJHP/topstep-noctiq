"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_CHART_OVERLAYS,
  type ChartOverlayKey,
  type ChartOverlaySettings,
} from "@/lib/chart-overlay-types";

export type { ChartOverlayKey, ChartOverlaySettings } from "@/lib/chart-overlay-types";
export {
  CHART_OVERLAY_LABELS,
  DEFAULT_CHART_OVERLAYS,
} from "@/lib/chart-overlay-types";

const STORAGE_KEY = "jhptrades-chart-overlays-v3";

function readStored(): ChartOverlaySettings {
  if (typeof window === "undefined") return DEFAULT_CHART_OVERLAYS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CHART_OVERLAYS;
    const parsed = JSON.parse(raw) as Partial<ChartOverlaySettings>;
    return { ...DEFAULT_CHART_OVERLAYS, ...parsed };
  } catch {
    return DEFAULT_CHART_OVERLAYS;
  }
}

export function useChartOverlaySettings(
  aiOverlays?: ChartOverlaySettings | null,
  summaryKey?: string | null
) {
  const [settings, setSettings] = useState<ChartOverlaySettings>(
    DEFAULT_CHART_OVERLAYS
  );
  const userTouchedRef = useRef(false);
  const lastSummaryKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setSettings(readStored());
  }, []);

  useEffect(() => {
    if (summaryKey && summaryKey !== lastSummaryKeyRef.current) {
      lastSummaryKeyRef.current = summaryKey;
      userTouchedRef.current = false;
    }
  }, [summaryKey]);

  useEffect(() => {
    if (!aiOverlays || userTouchedRef.current) return;
    setSettings(aiOverlays);
  }, [aiOverlays]);

  const toggle = useCallback((key: ChartOverlayKey) => {
    userTouchedRef.current = true;
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
      return next;
    });
  }, []);

  return { settings, toggle };
}
