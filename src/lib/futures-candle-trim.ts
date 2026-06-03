import type { Candle } from "@/lib/chart-data";

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? sorted[0]!;
}

function segmentMedian(candles: Candle[]): number {
  return median(candles.map((c) => c.close));
}

function rollThreshold(prev: number, cur: number): number {
  return Math.max(Math.min(prev, cur) * 0.018, 280);
}

/**
 * Yahoo `=F` hourly history stitches unadjusted contract months. Without trimming,
 * HTF aggregation mixes price regimes and sanitizers drop the live segment.
 */
export function trimFuturesCandleSeries(
  candles: Candle[],
  anchorPrice?: number
): Candle[] {
  if (candles.length < 4) return candles;

  const anchor =
    anchorPrice && anchorPrice > 0
      ? anchorPrice
      : candles[candles.length - 1]!.close;

  const rollIndices: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1]!.close;
    const cur = candles[i]!.close;
    if (Math.abs(cur - prev) > rollThreshold(prev, cur)) {
      rollIndices.push(i);
    }
  }

  let series = candles;
  if (rollIndices.length > 0) {
    const lastRoll = rollIndices[rollIndices.length - 1]!;
    const after = candles.slice(lastRoll);
    const before = candles.slice(0, lastRoll);
    series =
      Math.abs(segmentMedian(after) - anchor) <=
      Math.abs(segmentMedian(before) - anchor)
        ? after
        : before;
  }

  const maxDrift = Math.max(anchor * 0.11, anchor > 2000 ? 450 : 90);
  return series.filter((c) => Math.abs(c.close - anchor) <= maxDrift);
}
