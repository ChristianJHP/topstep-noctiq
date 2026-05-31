"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
} from "lightweight-charts";
import type { Candle } from "@/lib/chart-data";
import { aggregate4h } from "@/lib/ohlc-aggregate";
import { useIsMobile } from "@/hooks/use-is-mobile";

const BG = "#14171c";
const BULL = "#e4e4e7";
const BEAR = "#52525b";

export type ChartLevels = {
  h4High: number;
  h4Low: number;
  priorH4High: number;
  priorH4Low: number;
};

type MiniSymbolChartProps = {
  ticker: string;
  levels: ChartLevels;
};

function levelsDiffer(a: number, b: number, minPts = 8): boolean {
  return Math.abs(a - b) >= minPts;
}

export function MiniSymbolChart({ ticker, levels }: MiniSymbolChartProps) {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showPriorHigh = levelsDiffer(levels.h4High, levels.priorH4High);
  const showPriorLow = levelsDiffer(levels.h4Low, levels.priorH4Low);
  const barCount = isMobile ? 7 : 10;
  const barSpacing = isMobile ? 22 : 10;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: BG },
        textColor: "#52525b",
        fontSize: isMobile ? 11 : 10,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { visible: false },
      leftPriceScale: { visible: false },
      timeScale: {
        visible: false,
        borderVisible: false,
        barSpacing,
        minBarSpacing: isMobile ? 16 : 6,
        rightOffset: isMobile ? 6 : 4,
      },
      crosshair: {
        vertLine: { visible: false },
        horzLine: { visible: false },
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
      if (!container.clientWidth || !container.clientHeight) return;
      chart.applyOptions({
        width: container.clientWidth,
        height: container.clientHeight,
        layout: { attributionLogo: false },
        timeScale: {
          barSpacing,
          minBarSpacing: isMobile ? 16 : 6,
        },
      });
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      linesRef.current = [];
    };
  }, [mounted, isMobile, barSpacing]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    for (const line of linesRef.current) {
      series.removePriceLine(line);
    }
    linesRef.current = [];

    const addLine = (price: number, color: string, style: LineStyle) => {
      if (!Number.isFinite(price)) return;
      linesRef.current.push(
        series.createPriceLine({
          price,
          color,
          lineWidth: 1,
          lineStyle: style,
          axisLabelVisible: false,
          title: "",
        })
      );
    };

    addLine(levels.h4High, "#3b82f6", LineStyle.Solid);
    addLine(levels.h4Low, "#3b82f6", LineStyle.Solid);
    if (showPriorHigh) {
      addLine(levels.priorH4High, "#4b5563", LineStyle.Dashed);
    }
    if (showPriorLow) {
      addLine(levels.priorH4Low, "#4b5563", LineStyle.Dashed);
    }
  }, [levels, showPriorHigh, showPriorLow]);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          `/api/chart?ticker=${encodeURIComponent(ticker)}`
        );
        if (!res.ok) throw new Error("load failed");
        const { candles } = (await res.json()) as { candles: Candle[] };
        if (cancelled || !seriesRef.current) return;

        const bars = aggregate4h(candles).slice(-barCount);
        seriesRef.current.setData(
          bars.map((b) => ({
            time: b.time as import("lightweight-charts").UTCTimestamp,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
          }))
        );
        chartRef.current?.timeScale().fitContent();
        setError(null);
      } catch {
        if (!cancelled) setError("unavailable");
      }
    }

    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ticker, barCount, mounted]);

  if (error) {
    return (
      <div className="mini-chart-canvas flex items-center justify-center text-[10px] text-[var(--muted)]">
        —
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mini-chart-canvas"
      aria-hidden={!mounted}
    />
  );
}
