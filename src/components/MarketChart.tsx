"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import type { Candle } from "@/lib/chart-data";

const DEFAULT_HEIGHT = 300;
const BG = "#181b22";
const BULL = "#f4f4f5";
const BEAR = "#6b7280";

type MarketChartProps = {
  label: string;
  ticker: string;
  height?: number;
  /** No outer card — for use inside accordions */
  embedded?: boolean;
};

export function MarketChart({
  label,
  ticker,
  height = DEFAULT_HEIGHT,
  embedded = false,
}: MarketChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { color: BG },
        textColor: "#6b7280",
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { visible: false, labelVisible: false },
        horzLine: { visible: false, labelVisible: false },
      },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: BULL,
      downColor: BEAR,
      borderVisible: false,
      wickUpColor: BULL,
      wickDownColor: BEAR,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/chart?ticker=${encodeURIComponent(ticker)}`);
        if (!res.ok) throw new Error("load failed");
        const { candles } = (await res.json()) as { candles: Candle[] };
        if (cancelled || !seriesRef.current) return;
        seriesRef.current.setData(
          candles.map((c) => ({
            time: c.time as import("lightweight-charts").UTCTimestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        );
        chartRef.current?.timeScale().fitContent();
        setError(null);
      } catch {
        if (!cancelled) setError("Chart unavailable");
      }
    }

    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ticker]);

  const body = (
    <>
      <span className="chart-label">{label}</span>
      {error ? (
        <div
          className="flex items-center justify-center text-xs text-[var(--muted)]"
          style={{ height }}
        >
          {error}
        </div>
      ) : (
        <div ref={containerRef} style={{ height }} />
      )}
    </>
  );

  if (embedded) {
    return <div className="chart-card relative overflow-hidden">{body}</div>;
  }

  return (
    <div className="radar-card chart-card overflow-hidden">{body}</div>
  );
}
