import type { Candle } from "@/lib/chart-data";
import { trimFuturesCandleSeries } from "@/lib/futures-candle-trim";
import { aggregate1h, aggregate4h, type OhlcBar } from "@/lib/ohlc-aggregate";
import { candleSymbolBias, type SymbolContext } from "@/lib/htf-status";
import {
  drawPlotLine,
  fvgToChartZone,
  rejectionToChartZone,
  resolveDraw,
  shouldShowDrawOnLiquidity,
  type ChartPlotLine,
  type SymbolChartPlot,
} from "@/lib/market-analysis";
import { relevantFvgsForChart, type FairValueGap } from "@/lib/fvg-detect";
import {
  detectRejectionBlocks,
  relevantRejectionBlocksForChart,
} from "@/lib/rejection-block-detect";
import { sessionLinesForBars } from "@/lib/session-chart-lines";

export type ChartTimeframe = "5m" | "15m" | "1H" | "4H";

export const CHART_TIMEFRAMES: ChartTimeframe[] = ["1H", "5m", "15m", "4H"];

type TfConfig = {
  interval: "5m" | "15m" | "60m";
  range: string;
  barCount: { mobile: number; desktop: number };
  /** Cap SWR refresh while futures are open (ms). */
  refreshCapMs?: number;
};

export const CHART_TF_CONFIG: Record<ChartTimeframe, TfConfig> = {
  "5m": {
    interval: "5m",
    range: "1mo",
    barCount: { mobile: 320, desktop: 600 },
    refreshCapMs: 45_000,
  },
  "15m": {
    interval: "15m",
    range: "1mo",
    barCount: { mobile: 160, desktop: 280 },
  },
  "1H": {
    interval: "60m",
    range: "1y",
    barCount: { mobile: 600, desktop: 2500 },
  },
  "4H": {
    interval: "60m",
    range: "1y",
    barCount: { mobile: 480, desktop: 1200 },
  },
};

export function candlesToBars(candles: Candle[]): OhlcBar[] {
  return candles.map((c) => ({
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    bucketKey: String(c.time),
    time: c.time,
  }));
}

export function barsForTimeframe(
  candles: Candle[],
  timeframe: ChartTimeframe,
  limit: number,
  anchorPrice?: number
): OhlcBar[] {
  let source = candles;
  if (timeframe === "1H" || timeframe === "4H") {
    source = trimFuturesCandleSeries(candles, anchorPrice);
  }

  let bars: OhlcBar[];
  if (timeframe === "4H") {
    bars = aggregate4h(source);
  } else if (timeframe === "1H") {
    bars = aggregate1h(source);
  } else {
    bars = candlesToBars(source);
  }
  return bars.slice(-limit);
}

/** Update the forming bar with a live quote so the chart matches the header price. */
export function patchFormingBar(
  bars: OhlcBar[],
  livePrice: number | undefined
): OhlcBar[] {
  if (!livePrice || livePrice <= 0 || bars.length === 0) return bars;

  const last = bars[bars.length - 1]!;
  const maxPatch = Math.max(last.close * 0.025, last.close > 2000 ? 140 : 24);
  if (Math.abs(livePrice - last.close) > maxPatch) return bars;

  return [
    ...bars.slice(0, -1),
    {
      ...last,
      close: livePrice,
      high: Math.max(last.high, livePrice),
      low: Math.min(last.low, livePrice),
    },
  ];
}

export type PlottedFvg = {
  timeframe: "4H" | "1H";
  fvg: FairValueGap;
};

function plotTimeframeForChart(chartTf: ChartTimeframe): "4H" | "1H" {
  return chartTf === "4H" ? "4H" : "1H";
}

function fvgLimit(chartTf: ChartTimeframe): number {
  return 2;
}

export function plottedFvgsForTimeframe(
  symbol: SymbolContext,
  chartTf: ChartTimeframe
): PlottedFvg[] {
  const plotTf = plotTimeframeForChart(chartTf);
  const current = symbol.current;
  const pool =
    plotTf === "4H" ? symbol.analysis.fvgs4h : symbol.analysis.fvgs1h;

  const picked = relevantFvgsForChart(
    pool,
    current,
    fvgLimit(chartTf),
    symbol.label
  );
  return picked.map((fvg) => ({ timeframe: plotTf, fvg }));
}

function buildFvgPlot(
  symbol: SymbolContext,
  chartTf: ChartTimeframe
): { lines: ChartPlotLine[]; zones: SymbolChartPlot["zones"] } {
  const plotted = plottedFvgsForTimeframe(symbol, chartTf);
  const lines: ChartPlotLine[] = [];
  const zones: SymbolChartPlot["zones"] = [];

  for (const { fvg } of plotted) {
    zones.push(fvgToChartZone(fvg));
  }

  return { lines, zones };
}

export function plotForTimeframe(
  symbol: SymbolContext,
  timeframe: ChartTimeframe
): SymbolChartPlot {
  const bias = candleSymbolBias(symbol);
  const { drawSide, drawLevel } = resolveDraw(
    bias,
    symbol.analysis.swingHigh,
    symbol.analysis.swingLow,
    symbol.h4High,
    symbol.h4Low,
    symbol.current
  );

  const { zones: fvgZones } = buildFvgPlot(symbol, timeframe);
  const lines: ChartPlotLine[] = [];

  if (shouldShowDrawOnLiquidity(bias)) {
    lines.push(drawPlotLine(drawSide, drawLevel));
  }

  lines.push(
    {
      price: symbol.h4High,
      color: "rgba(61, 214, 140, 0.55)",
      style: "solid",
      label: "4H H",
      role: "level",
    },
    {
      price: symbol.h4Low,
      color: "rgba(242, 85, 90, 0.55)",
      style: "solid",
      label: "4H L",
      role: "level",
    }
  );

  if (Math.abs(symbol.priorH4High - symbol.h4High) >= 8) {
    lines.push({
      price: symbol.priorH4High,
      color: "rgba(122, 132, 148, 0.45)",
      style: "dashed",
      label: "Pr H",
      role: "level",
    });
  }
  if (Math.abs(symbol.priorH4Low - symbol.h4Low) >= 8) {
    lines.push({
      price: symbol.priorH4Low,
      color: "rgba(122, 132, 148, 0.45)",
      style: "dashed",
      label: "Pr L",
      role: "level",
    });
  }

  const cisd = symbol.analysis.cisd;
  if (cisd) {
    lines.push({
      price: cisd.price,
      color:
        cisd.type === "bullish"
          ? "rgba(61, 214, 140, 0.75)"
          : "rgba(242, 85, 90, 0.75)",
      style: "solid",
      label: "CISD",
      role: "cisd",
    });
  }

  return { lines, zones: fvgZones };
}

/** RB scan window — only recent structure matters for overlay picks. */
const RB_DETECT_MAX_BARS = 480;

export function rejectionZonesForBars(
  bars: OhlcBar[],
  chartTf: ChartTimeframe,
  current: number,
  max = 2,
  symbolLabel?: string
): SymbolChartPlot["zones"] {
  if (!bars.length || current <= 0) return [];
  const scanBars =
    bars.length > RB_DETECT_MAX_BARS
      ? bars.slice(-RB_DETECT_MAX_BARS)
      : bars;
  const blocks = detectRejectionBlocks(scanBars);
  const picked = relevantRejectionBlocksForChart(
    blocks,
    current,
    max,
    symbolLabel
  );
  return picked.map((block) => rejectionToChartZone(block, chartTf));
}

export { sessionLinesForBars } from "@/lib/session-chart-lines";

/** Empty bar slots after the forming candle so it isn't flush against the price scale. */
export const CHART_RIGHT_OFFSET = 3;

/** Default bars in view on load / reset — leaves history to pan into. */
export const CHART_DEFAULT_VISIBLE_BARS = { mobile: 56, desktop: 80 };

export function defaultVisibleLogicalRange(
  barCount: number,
  isMobile: boolean
): { from: number; to: number } {
  const target = isMobile
    ? CHART_DEFAULT_VISIBLE_BARS.mobile
    : CHART_DEFAULT_VISIBLE_BARS.desktop;
  const shown = Math.min(barCount, target);
  return {
    from: Math.max(-0.5, barCount - shown - 0.5),
    to: barCount - 0.5,
  };
}

export function fitBarSpacing(
  containerWidth: number,
  barCount: number,
  isMobile: boolean
): number {
  const scaleW = isMobile ? 44 : 52;
  const plotW = Math.max(120, containerWidth - scaleW - 8);
  const slots = Math.max(barCount, 1) + CHART_RIGHT_OFFSET;
  return Math.max(3, plotW / slots);
}

/** Fill the plot width with a recent window of bars (pan/zoom reveals the rest). */
export function fitChartTimeScale(
  chart: {
    applyOptions: (opts: {
      timeScale: {
        barSpacing: number;
        minBarSpacing: number;
        maxBarSpacing: number;
        rightOffset: number;
      };
    }) => void;
    timeScale: () => {
      setVisibleLogicalRange: (range: { from: number; to: number }) => void;
    };
  },
  containerWidth: number,
  barCount: number,
  isMobile: boolean
): void {
  if (barCount <= 0 || containerWidth <= 0) return;

  const range = defaultVisibleLogicalRange(barCount, isMobile);
  const visibleBars = Math.max(1, Math.ceil(range.to - range.from));
  const spacing = fitBarSpacing(containerWidth, visibleBars, isMobile);

  chart.applyOptions({
    timeScale: {
      barSpacing: spacing,
      minBarSpacing: 2,
      maxBarSpacing: 48,
      rightOffset: CHART_RIGHT_OFFSET,
    },
  });

  chart.timeScale().setVisibleLogicalRange(range);
}

/** Recompute bar width after resize without resetting scroll/zoom. */
export function updateChartBarSpacing(
  chart: {
    applyOptions: (opts: {
      timeScale: {
        barSpacing: number;
        minBarSpacing: number;
        maxBarSpacing: number;
      };
    }) => void;
  },
  containerWidth: number,
  barCount: number,
  isMobile: boolean
): void {
  if (barCount <= 0 || containerWidth <= 0) return;

  const spacing = fitBarSpacing(containerWidth, barCount, isMobile);

  chart.applyOptions({
    timeScale: {
      barSpacing: spacing,
      minBarSpacing: 2,
      maxBarSpacing: 48,
    },
  });
}
