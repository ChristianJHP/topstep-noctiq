"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { ChartPlotZone, SymbolChartPlot } from "@/lib/market-analysis";
import {
  barsForTimeframe,
  CHART_TF_CONFIG,
  fitChartTimeScale,
  type ChartTimeframe,
} from "@/lib/chart-timeframe";
import { useChartCandles } from "@/hooks/use-chart-candles";
import { useIsMobile } from "@/hooks/use-is-mobile";

const BG = "#12151a";
const BULL = "#c8cdd6";
const BEAR = "#5c6573";
const WICK_BULL = "#8b939e";
const WICK_BEAR = "#4a5260";

type MiniSymbolChartProps = {
  ticker: string;
  plot: SymbolChartPlot;
  timeframe: ChartTimeframe;
};

function makeAutoscale(plot: SymbolChartPlot) {
  return (
    original: () => { priceRange: { minValue: number; maxValue: number } } | null
  ) => {
    const res = original();
    if (!res) return res;

    let { minValue, maxValue } = res.priceRange;
    const candleSpan = Math.max(maxValue - minValue, 1);
    const reach = candleSpan * 0.22;

    for (const line of plot.lines) {
      if (!Number.isFinite(line.price)) continue;
      const p = line.price;
      if (p >= minValue - reach && p <= maxValue + reach) {
        minValue = Math.min(minValue, p);
        maxValue = Math.max(maxValue, p);
      }
    }

    for (const zone of plot.zones) {
      if (zone.top < minValue - reach || zone.bottom > maxValue + reach) continue;
      minValue = Math.min(minValue, zone.bottom);
      maxValue = Math.max(maxValue, zone.top);
    }

    const span = maxValue - minValue;
    const pad = Math.max(8, span * 0.05);
    return {
      priceRange: { minValue: minValue - pad, maxValue: maxValue + pad },
      margins: { above: 10, below: 10 },
    };
  };
}

function syncZoneOverlay(
  chart: IChartApi,
  series: ISeriesApi<"Candlestick">,
  overlay: HTMLElement,
  zones: ChartPlotZone[],
  lastBarTime: number
) {
  overlay.replaceChildren();
  const endTime = lastBarTime;

  for (const zone of zones) {
    const x1 = chart.timeScale().timeToCoordinate(zone.startTime as UTCTimestamp);
    const x2 = chart.timeScale().timeToCoordinate(endTime as UTCTimestamp);
    const yTop = series.priceToCoordinate(zone.top);
    const yBottom = series.priceToCoordinate(zone.bottom);
    if (x1 == null || x2 == null || yTop == null || yBottom == null) continue;

    const band = document.createElement("div");
    band.className = `chart-zone chart-zone--${zone.type} chart-zone--${zone.timeframe.toLowerCase()}`;
    band.style.left = `${Math.min(x1, x2)}px`;
    band.style.width = `${Math.max(Math.abs(x2 - x1), 4)}px`;
    band.style.top = `${Math.min(yTop, yBottom)}px`;
    band.style.height = `${Math.max(Math.abs(yBottom - yTop), 2)}px`;
    band.title = zone.label;
    overlay.appendChild(band);
  }
}

export function MiniSymbolChart({
  ticker,
  plot,
  timeframe,
}: MiniSymbolChartProps) {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const lastBarTimeRef = useRef<number>(0);
  const plotRef = useRef(plot);
  const barCountRef = useRef(0);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  plotRef.current = plot;
  const tfConfig = CHART_TF_CONFIG[timeframe];
  const barLimit = isMobile
    ? tfConfig.barCount.mobile
    : tfConfig.barCount.desktop;

  const { candles, isLoading, error: fetchError } = useChartCandles(
    ticker,
    tfConfig.interval,
    tfConfig.range
  );

  const fitToContainer = useCallback(() => {
    const chart = chartRef.current;
    const container = containerRef.current;
    if (!chart || !container || !barCountRef.current) return;
    fitChartTimeScale(
      chart,
      container.clientWidth,
      barCountRef.current,
      isMobile
    );
  }, [isMobile]);

  const refreshOverlay = useCallback(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const overlay = overlayRef.current;
    if (!chart || !series || !overlay || !lastBarTimeRef.current) return;
    syncZoneOverlay(
      chart,
      series,
      overlay,
      plotRef.current.zones,
      lastBarTimeRef.current
    );
  }, []);

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
        textColor: "#94a3b8",
        fontSize: isMobile ? 10 : 9,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(148, 163, 184, 0.06)" },
      },
      rightPriceScale: {
        visible: true,
        borderVisible: false,
        scaleMargins: { top: 0.06, bottom: 0.06 },
        minimumWidth: isMobile ? 44 : 52,
      },
      leftPriceScale: { visible: false },
      timeScale: {
        visible: false,
        borderVisible: false,
        barSpacing: 6,
        minBarSpacing: 2,
        maxBarSpacing: 48,
        rightOffset: 2,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      crosshair: {
        vertLine: { visible: false },
        horzLine: { visible: false },
      },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: false,
        pinch: true,
        axisPressedMouseMove: false,
        axisDoubleClickReset: true,
      },
      kineticScroll: {
        touch: true,
        mouse: true,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: BULL,
      downColor: BEAR,
      borderVisible: false,
      wickUpColor: WICK_BULL,
      wickDownColor: WICK_BEAR,
      autoscaleInfoProvider: makeAutoscale(plotRef.current),
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const onDblClick = () => {
      fitToContainer();
      refreshOverlay();
    };
    container.addEventListener("dblclick", onDblClick);

    const resize = () => {
      if (!container.clientWidth || !container.clientHeight) return;
      chart.applyOptions({
        width: container.clientWidth,
        height: container.clientHeight,
        layout: { attributionLogo: false },
      });
      fitToContainer();
      refreshOverlay();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    chart.timeScale().subscribeVisibleLogicalRangeChange(refreshOverlay);
    resize();

    return () => {
      container.removeEventListener("dblclick", onDblClick);
      ro.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(refreshOverlay);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      linesRef.current = [];
    };
  }, [mounted, isMobile, fitToContainer, refreshOverlay]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    series.applyOptions({ autoscaleInfoProvider: makeAutoscale(plot) });

    for (const line of linesRef.current) {
      series.removePriceLine(line);
    }
    linesRef.current = [];

    for (const line of plot.lines) {
      if (!Number.isFinite(line.price)) continue;
      const isDraw = line.label?.startsWith("Draw");
      const isFvg = line.label?.includes("FVG");
      const isStructural =
        line.label === "4H H" ||
        line.label === "4H L" ||
        line.label === "1H H" ||
        line.label === "1H L";
      if (!isDraw && !isFvg && !isStructural) continue;

      linesRef.current.push(
        series.createPriceLine({
          price: line.price,
          color: line.color,
          lineWidth: isDraw ? 2 : 1,
          lineStyle:
            line.style === "dashed" ? LineStyle.Dashed : LineStyle.Solid,
          axisLabelVisible: isDraw,
          title: isDraw ? (line.label ?? "") : "",
        })
      );
    }

    fitToContainer();
    refreshOverlay();
  }, [plot, fitToContainer, refreshOverlay]);

  useEffect(() => {
    if (!mounted || !seriesRef.current || !candles.length) return;

    const bars = barsForTimeframe(candles, timeframe, barLimit);
    if (bars.length === 0) return;

    barCountRef.current = bars.length;
    lastBarTimeRef.current = bars[bars.length - 1].time;
    seriesRef.current.setData(
      bars.map((b) => ({
        time: b.time as UTCTimestamp,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }))
    );
    fitToContainer();
    refreshOverlay();
    setError(null);
  }, [candles, timeframe, barLimit, mounted, fitToContainer, refreshOverlay]);

  useEffect(() => {
    if (fetchError && !candles.length) setError("unavailable");
  }, [fetchError, candles.length]);

  if (error || (isLoading && !candles.length)) {
    return (
      <div className="mini-chart-canvas flex items-center justify-center text-[10px] text-[var(--muted)]">
        —
      </div>
    );
  }

  return (
    <div className="mini-chart-stack">
      <div className="mini-chart-canvas-wrap">
        <div
          ref={containerRef}
          className="mini-chart-canvas mini-chart-canvas--interactive"
          aria-hidden={!mounted}
        />
        <div ref={overlayRef} className="chart-zones-overlay" aria-hidden />
      </div>
    </div>
  );
}
