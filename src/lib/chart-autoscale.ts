import type { SymbolChartPlot } from "@/lib/market-analysis";
import type { OhlcBar } from "@/lib/ohlc-aggregate";

/** Drop bad ticks — anchor on live/recent price, not global median (futures roll). */
export function sanitizeChartBars(
  bars: OhlcBar[],
  anchorPrice?: number
): OhlcBar[] {
  if (bars.length < 8) return bars;

  const anchor =
    anchorPrice && anchorPrice > 0
      ? anchorPrice
      : bars[bars.length - 1]!.close;

  const ranges = bars
    .map((b) => Math.max(b.high - b.low, 0.01))
    .sort((a, b) => a - b);
  const typicalRange = ranges[Math.floor(ranges.length / 2)] ?? 4;
  const maxDist = Math.max(typicalRange * 8, anchor * 0.055, anchor > 2000 ? 320 : 48);

  return bars.filter((b) => {
    if (!Number.isFinite(b.open + b.high + b.low + b.close)) return false;
    const bodyMid = (b.open + b.close) / 2;
    if (Math.abs(bodyMid - anchor) > maxDist) return false;
    if (b.high - b.low > maxDist * 2.5) return false;
    return true;
  });
}

function overlapsRange(
  low: number,
  high: number,
  minValue: number,
  maxValue: number
): boolean {
  return high >= minValue && low <= maxValue;
}

/** Keep overlays near visible candles — never let a wide zone blow out the scale. */
export function expandAutoscaleForPlot(
  candleMin: number,
  candleMax: number,
  plot: SymbolChartPlot
): { minValue: number; maxValue: number } {
  let minValue = candleMin;
  let maxValue = candleMax;
  const candleSpan = Math.max(maxValue - minValue, 1);
  const maxExpand = Math.max(candleSpan * 0.32, 12);
  const floor = minValue - maxExpand;
  const ceiling = maxValue + maxExpand;

  for (const line of plot.lines) {
    if (!Number.isFinite(line.price)) continue;
    const p = line.price;
    if (p < floor || p > ceiling) continue;
    minValue = Math.min(minValue, p);
    maxValue = Math.max(maxValue, p);
  }

  for (const zone of plot.zones) {
    const zLow = Math.min(zone.bottom, zone.top);
    const zHigh = Math.max(zone.bottom, zone.top);
    const zoneSpan = zHigh - zLow;

    if (zoneSpan > candleSpan * 2.5) continue;

    if (!overlapsRange(zLow, zHigh, minValue, maxValue)) {
      const gap =
        zHigh < minValue
          ? minValue - zHigh
          : zLow > maxValue
            ? zLow - maxValue
            : 0;
      if (gap > maxExpand) continue;
    }

    const clipLow = Math.max(zLow, floor);
    const clipHigh = Math.min(zHigh, ceiling);
    if (clipHigh <= clipLow) continue;

    minValue = Math.min(minValue, clipLow);
    maxValue = Math.max(maxValue, clipHigh);
  }

  const span = maxValue - minValue;
  const pad = Math.max(4, span * 0.04);
  return { minValue: minValue - pad, maxValue: maxValue + pad };
}

export function makeChartAutoscaleProvider(plot: SymbolChartPlot) {
  return (
    original: () => { priceRange: { minValue: number; maxValue: number } } | null
  ) => {
    const res = original();
    if (!res?.priceRange) return res;

    const { minValue, maxValue } = expandAutoscaleForPlot(
      res.priceRange.minValue,
      res.priceRange.maxValue,
      plot
    );

    return {
      priceRange: { minValue, maxValue },
      margins: { above: 8, below: 8 },
    };
  };
}
