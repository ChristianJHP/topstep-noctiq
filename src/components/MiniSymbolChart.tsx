"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  TickMarkType,
  createChart,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  filterChartPlot,
  type ChartPlotLine,
  type ChartPlotZone,
  type SymbolChartPlot,
} from "@/lib/market-analysis";
import type { ChartOverlaySettings } from "@/lib/chart-overlay-types";
import type { OhlcBar } from "@/lib/ohlc-aggregate";
import {
  barsForTimeframe,
  CHART_RIGHT_OFFSET,
  CHART_TF_CONFIG,
  fitChartTimeScale,
  patchFormingBar,
  rejectionZonesForBars,
  sessionLinesForBars,
  type ChartTimeframe,
} from "@/lib/chart-timeframe";
import {
  makeChartAutoscaleProvider,
  sanitizeChartBars,
} from "@/lib/chart-autoscale";
import { useChartCandles } from "@/hooks/use-chart-candles";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { ChartSkeleton } from "@/components/radar/LiveSkeleton";
import {
  formatChartEtCrosshair,
  formatChartEtTickMark,
  type ChartTickMarkKind,
} from "@/lib/chart-time-label";

const BG = "#12151a";
const BULL = "#c8cdd6";
const BEAR = "#5c6573";
const WICK_BULL = "#8b939e";
const WICK_BEAR = "#4a5260";

const CROSSHAIR_LINE = "rgba(148, 163, 184, 0.35)";
const CROSSHAIR_LABEL_BG = "#1e2430";

function tickMarkKind(type: TickMarkType): ChartTickMarkKind {
  switch (type) {
    case TickMarkType.Year:
      return "year";
    case TickMarkType.Month:
      return "month";
    case TickMarkType.DayOfMonth:
      return "day";
    case TickMarkType.TimeWithSeconds:
      return "time-sec";
    default:
      return "time";
  }
}

type MiniSymbolChartProps = {
  ticker: string;
  symbolLabel?: string;
  plot: SymbolChartPlot;
  timeframe: ChartTimeframe;
  overlays?: ChartOverlaySettings;
  currentPrice?: number;
};

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
    const tfClass = zone.timeframe.toLowerCase();
    band.className = `chart-zone chart-zone--${zone.type} chart-zone--${zone.kind} chart-zone--${tfClass}`;
    band.style.left = `${Math.min(x1, x2)}px`;
    band.style.width = `${Math.max(Math.abs(x2 - x1), 4)}px`;
    band.style.top = `${Math.min(yTop, yBottom)}px`;
    band.style.height = `${Math.max(Math.abs(yBottom - yTop), 2)}px`;
    band.title = zone.label;
    overlay.appendChild(band);
  }
}

function lineStyleForRole(
  role: SymbolChartPlot["lines"][number]["role"],
  style: "solid" | "dashed"
): LineStyle {
  if (role === "draw") return LineStyle.Dashed;
  if (role === "session") return LineStyle.Dotted;
  if (role === "cisd") return LineStyle.Solid;
  return style === "dashed" ? LineStyle.Dashed : LineStyle.Solid;
}

export function MiniSymbolChart({
  ticker,
  symbolLabel,
  plot,
  timeframe,
  overlays,
  currentPrice,
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
  const lastBarRef = useRef<OhlcBar | null>(null);
  const userHasPannedRef = useRef(false);
  const programmaticFitRef = useRef(false);
  const chartDataKeyRef = useRef("");
  const overlayFrameRef = useRef<number | null>(null);
  const fitToContainerRef = useRef<(resetPan?: boolean) => void>(() => {});
  const refreshOverlayRef = useRef<() => void>(() => {});
  const [rbZones, setRbZones] = useState<ChartPlotZone[]>([]);
  const [sessionLines, setSessionLines] = useState<ChartPlotLine[]>([]);
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
    tfConfig.range,
    tfConfig.refreshCapMs
  );

  const { candles: candles15m } = useChartCandles(ticker, "15m", "1mo");

  const mergedPlot = useMemo(() => {
    const combined: SymbolChartPlot = {
      lines: [...plot.lines, ...sessionLines],
      zones: [...plot.zones, ...rbZones],
    };
    return overlays ? filterChartPlot(combined, overlays) : combined;
  }, [plot, overlays, rbZones, sessionLines]);

  const fitToContainer = useCallback((resetPan = false) => {
    const chart = chartRef.current;
    const container = containerRef.current;
    if (!chart || !container || !barCountRef.current) return;
    programmaticFitRef.current = true;
    fitChartTimeScale(
      chart,
      container.clientWidth,
      barCountRef.current,
      isMobile
    );
    requestAnimationFrame(() => {
      programmaticFitRef.current = false;
    });
    if (resetPan) userHasPannedRef.current = false;
  }, [isMobile]);

  const refreshOverlay = useCallback(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const overlay = overlayRef.current;
    if (!chart || !series || !overlay || !lastBarTimeRef.current) return;

    const combined: SymbolChartPlot = {
      lines: [...plotRef.current.lines, ...sessionLines],
      zones: [...plotRef.current.zones, ...rbZones],
    };
    const visible = overlays ? filterChartPlot(combined, overlays) : combined;

    syncZoneOverlay(
      chart,
      series,
      overlay,
      visible.zones,
      lastBarTimeRef.current
    );
  }, [overlays, rbZones, sessionLines]);

  const scheduleOverlayRefresh = useCallback(() => {
    if (overlayFrameRef.current != null) return;
    overlayFrameRef.current = requestAnimationFrame(() => {
      overlayFrameRef.current = null;
      refreshOverlayRef.current();
    });
  }, []);

  fitToContainerRef.current = fitToContainer;
  refreshOverlayRef.current = refreshOverlay;

  useEffect(() => {
    scheduleOverlayRefresh();
  }, [refreshOverlay, scheduleOverlayRefresh]);

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
      localization: {
        locale: "en-US",
        timeFormatter: (time: Time) => formatChartEtCrosshair(time),
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(148, 163, 184, 0.06)" },
      },
      rightPriceScale: {
        visible: true,
        borderVisible: false,
        scaleMargins: { top: 0.06, bottom: 0.1 },
        minimumWidth: isMobile ? 44 : 52,
      },
      leftPriceScale: { visible: false },
      timeScale: {
        visible: true,
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        ticksVisible: true,
        tickMarkFormatter: (time: Time, type: TickMarkType) =>
          formatChartEtTickMark(time, tickMarkKind(type)),
        barSpacing: 6,
        minBarSpacing: 2,
        maxBarSpacing: 48,
        rightOffset: CHART_RIGHT_OFFSET,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          visible: true,
          labelVisible: true,
          color: CROSSHAIR_LINE,
          width: 1,
          labelBackgroundColor: CROSSHAIR_LABEL_BG,
        },
        horzLine: {
          visible: true,
          labelVisible: true,
          color: "rgba(148, 163, 184, 0.2)",
          width: 1,
          labelBackgroundColor: CROSSHAIR_LABEL_BG,
        },
      },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
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
      autoscaleInfoProvider: makeChartAutoscaleProvider(plotRef.current),
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const onDblClick = () => {
      fitToContainerRef.current(true);
      scheduleOverlayRefresh();
    };
    container.addEventListener("dblclick", onDblClick);

    const onVisibleRangeChange = () => {
      scheduleOverlayRefresh();
      if (!programmaticFitRef.current) {
        userHasPannedRef.current = true;
      }
    };

    const resize = () => {
      if (!container.clientWidth || !container.clientHeight) return;
      chart.applyOptions({
        width: container.clientWidth,
        height: container.clientHeight,
        layout: { attributionLogo: false },
      });
      if (!userHasPannedRef.current) {
        fitToContainerRef.current();
      }
      scheduleOverlayRefresh();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleRangeChange);
    resize();

    return () => {
      container.removeEventListener("dblclick", onDblClick);
      ro.disconnect();
      chart
        .timeScale()
        .unsubscribeVisibleLogicalRangeChange(onVisibleRangeChange);
      if (overlayFrameRef.current != null) {
        cancelAnimationFrame(overlayFrameRef.current);
        overlayFrameRef.current = null;
      }
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      linesRef.current = [];
    };
  }, [mounted, isMobile, scheduleOverlayRefresh]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    series.applyOptions({
      autoscaleInfoProvider: makeChartAutoscaleProvider(mergedPlot),
    });

    for (const line of linesRef.current) {
      series.removePriceLine(line);
    }
    linesRef.current = [];

    for (const line of mergedPlot.lines) {
      if (!Number.isFinite(line.price)) continue;

      linesRef.current.push(
        series.createPriceLine({
          price: line.price,
          color: line.color,
          lineWidth:
            line.role === "draw" ? 2 : line.role === "session" ? 1 : 1,
          lineStyle: lineStyleForRole(line.role, line.style),
          axisLabelVisible: line.role === "draw" || line.role === "cisd",
          title: line.role === "session" ? "" : (line.label ?? ""),
        })
      );
    }

    scheduleOverlayRefresh();
  }, [mergedPlot, scheduleOverlayRefresh]);

  useEffect(() => {
    if (!mounted || !seriesRef.current || !candles.length) return;

    let bars = sanitizeChartBars(
      barsForTimeframe(candles, timeframe, barLimit)
    );
    if (bars.length === 0) return;

    const livePrice = currentPrice ?? bars[bars.length - 1]!.close;
    bars = patchFormingBar(bars, livePrice);

    barCountRef.current = bars.length;
    lastBarTimeRef.current = bars[bars.length - 1]!.time;

    const price = livePrice;
    setRbZones(
      rejectionZonesForBars(bars, timeframe, price, 2, symbolLabel)
    );

    if (candles15m.length) {
      const sessBars = barsForTimeframe(candles15m, "15m", barLimit);
      setSessionLines(sessionLinesForBars(sessBars));
    } else {
      setSessionLines([]);
    }

    lastBarRef.current = bars[bars.length - 1] ?? null;

    seriesRef.current.setData(
      bars.map((b) => ({
        time: b.time as UTCTimestamp,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }))
    );

    const dataKey = `${ticker}:${timeframe}`;
    const isNewChartContext = chartDataKeyRef.current !== dataKey;
    chartDataKeyRef.current = dataKey;
    if (isNewChartContext) {
      fitToContainer(true);
    }

    scheduleOverlayRefresh();
    setError(null);
  }, [
    candles,
    candles15m,
    timeframe,
    barLimit,
    mounted,
    ticker,
    fitToContainer,
    scheduleOverlayRefresh,
    symbolLabel,
  ]);

  /** Live quote tick — update forming candle only (no full chart rebuild). */
  useEffect(() => {
    const series = seriesRef.current;
    const last = lastBarRef.current;
    if (!mounted || !series || !last || currentPrice == null || currentPrice <= 0) {
      return;
    }
    if (Math.abs(last.close - currentPrice) < 0.01) return;

    const updated: OhlcBar = {
      ...last,
      close: currentPrice,
      high: Math.max(last.high, currentPrice),
      low: Math.min(last.low, currentPrice),
    };
    lastBarRef.current = updated;
    series.update({
      time: updated.time as UTCTimestamp,
      open: updated.open,
      high: updated.high,
      low: updated.low,
      close: updated.close,
    });
  }, [currentPrice, mounted]);

  useEffect(() => {
    if (fetchError && !candles.length) setError("unavailable");
  }, [fetchError, candles.length]);

  if (error || (isLoading && !candles.length)) {
    return <ChartSkeleton />;
  }

  return (
    <div className="mini-chart-stack live-enter">
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
