import type { Candle } from "@/lib/chart-data";
import { aggregate1h, aggregate4h, type OhlcBar } from "@/lib/ohlc-aggregate";
import { candleSymbolBias, type SymbolContext } from "@/lib/htf-status";
import {
  drawPlotLine,
  fvgToChartZone,
  rejectionToChartZone,
  resolveDraw,
  type ChartPlotLine,
  type SymbolChartPlot,
} from "@/lib/market-analysis";
import { relevantFvgsForChart, type FairValueGap } from "@/lib/fvg-detect";
import {
  detectRejectionBlocks,
  relevantRejectionBlocksForChart,
} from "@/lib/rejection-block-detect";
import { sessionLinesForBars } from "@/lib/session-chart-lines";

export type ChartTimeframe = "15m" | "1H" | "4H";

export const CHART_TIMEFRAMES: ChartTimeframe[] = ["15m", "1H", "4H"];

type TfConfig = {
  interval: "15m" | "60m";
  range: string;
  barCount: { mobile: number; desktop: number };
};

export const CHART_TF_CONFIG: Record<ChartTimeframe, TfConfig> = {
  "15m": {
    interval: "15m",
    range: "7d",
    barCount: { mobile: 64, desktop: 96 },
  },
  "1H": {
    interval: "60m",
    range: "3mo",
    barCount: { mobile: 48, desktop: 72 },
  },
  "4H": {
    interval: "60m",
    range: "3mo",
    barCount: { mobile: 40, desktop: 56 },
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
  limit: number
): OhlcBar[] {
  let bars: OhlcBar[];
  if (timeframe === "4H") {
    bars = aggregate4h(candles);
  } else if (timeframe === "1H") {
    bars = aggregate1h(candles);
  } else {
    bars = candlesToBars(candles);
  }
  return bars.slice(-limit);
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

  const picked = relevantFvgsForChart(pool, current, fvgLimit(chartTf));
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
  const draw = drawPlotLine(drawSide, drawLevel);

  const { zones: fvgZones } = buildFvgPlot(symbol, timeframe);
  const lines: ChartPlotLine[] = [draw];

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

export function rejectionZonesForBars(
  bars: OhlcBar[],
  chartTf: ChartTimeframe,
  current: number,
  max = 2
): SymbolChartPlot["zones"] {
  if (!bars.length || current <= 0) return [];
  const blocks = detectRejectionBlocks(bars);
  const picked = relevantRejectionBlocksForChart(blocks, current, max);
  return picked.map((block) => rejectionToChartZone(block, chartTf));
}

export { sessionLinesForBars } from "@/lib/session-chart-lines";

export function fitBarSpacing(
  containerWidth: number,
  barCount: number,
  isMobile: boolean
): number {
  const scaleW = isMobile ? 44 : 52;
  const plotW = Math.max(120, containerWidth - scaleW - 8);
  const rightOffset = 2;
  const slots = Math.max(barCount, 1) + rightOffset;
  return Math.max(3, plotW / slots);
}

/** Fill the plot width with the loaded bars and snap the viewport to them. */
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

  const rightOffset = 2;
  const spacing = fitBarSpacing(containerWidth, barCount, isMobile);

  chart.applyOptions({
    timeScale: {
      barSpacing: spacing,
      minBarSpacing: 2,
      maxBarSpacing: 48,
      rightOffset,
    },
  });

  chart.timeScale().setVisibleLogicalRange({
    from: -0.5,
    to: barCount - 1 + rightOffset * 0.5,
  });
}
