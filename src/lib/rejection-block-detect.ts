import type { OhlcBar } from "@/lib/ohlc-aggregate";

export type RejectionBlock = {
  id: string;
  type: "bullish" | "bearish";
  top: number;
  bottom: number;
  mid: number;
  formedAt: number;
  mitigated: boolean;
};

const SWING_RADIUS = 2;
const SWING_LOOKBACK = 20;
const RB_SEARCH_BACK = 8;
const MIN_ZONE_PTS = 1.5;
const DISPLACEMENT_BARS = 3;
const DISPLACEMENT_BODY_RATIO = 0.45;

function isBullish(bar: OhlcBar): boolean {
  return bar.close > bar.open;
}

function isBearish(bar: OhlcBar): boolean {
  return bar.close < bar.open;
}

function bodySize(bar: OhlcBar): number {
  return Math.abs(bar.close - bar.open);
}

function avgRange(bars: OhlcBar[], endIdx: number, count = 10): number {
  const start = Math.max(0, endIdx - count);
  const slice = bars.slice(start, endIdx);
  if (!slice.length) return 4;
  return slice.reduce((sum, b) => sum + (b.high - b.low), 0) / slice.length;
}

function isSwingHigh(bars: OhlcBar[], i: number): boolean {
  if (i < SWING_RADIUS || i >= bars.length - SWING_RADIUS) return false;
  const level = bars[i].high;
  for (let j = i - SWING_RADIUS; j <= i + SWING_RADIUS; j++) {
    if (j !== i && bars[j].high >= level) return false;
  }
  return true;
}

function isSwingLow(bars: OhlcBar[], i: number): boolean {
  if (i < SWING_RADIUS || i >= bars.length - SWING_RADIUS) return false;
  const level = bars[i].low;
  for (let j = i - SWING_RADIUS; j <= i + SWING_RADIUS; j++) {
    if (j !== i && bars[j].low <= level) return false;
  }
  return true;
}

function nearestSwingHighBefore(bars: OhlcBar[], idx: number): number | null {
  for (let j = idx - 1; j >= Math.max(SWING_RADIUS, idx - SWING_LOOKBACK); j--) {
    if (isSwingHigh(bars, j)) return bars[j].high;
  }
  return null;
}

function nearestSwingLowBefore(bars: OhlcBar[], idx: number): number | null {
  for (let j = idx - 1; j >= Math.max(SWING_RADIUS, idx - SWING_LOOKBACK); j--) {
    if (isSwingLow(bars, j)) return bars[j].low;
  }
  return null;
}

function lastBullishBefore(bars: OhlcBar[], idx: number): number | null {
  for (let j = idx; j >= Math.max(0, idx - RB_SEARCH_BACK); j--) {
    if (isBullish(bars[j])) return j;
  }
  return null;
}

function lastBearishBefore(bars: OhlcBar[], idx: number): number | null {
  for (let j = idx; j >= Math.max(0, idx - RB_SEARCH_BACK); j--) {
    if (isBearish(bars[j])) return j;
  }
  return null;
}

function hasBearishDisplacement(
  bars: OhlcBar[],
  fromIdx: number,
  minBody: number
): boolean {
  const end = Math.min(bars.length - 1, fromIdx + DISPLACEMENT_BARS);
  for (let j = fromIdx; j <= end; j++) {
    if (isBearish(bars[j]) && bodySize(bars[j]) >= minBody) return true;
  }
  return false;
}

function hasBullishDisplacement(
  bars: OhlcBar[],
  fromIdx: number,
  minBody: number
): boolean {
  const end = Math.min(bars.length - 1, fromIdx + DISPLACEMENT_BARS);
  for (let j = fromIdx; j <= end; j++) {
    if (isBullish(bars[j]) && bodySize(bars[j]) >= minBody) return true;
  }
  return false;
}

function annotateMitigation(blocks: RejectionBlock[], bars: OhlcBar[]): RejectionBlock[] {
  const timeIndex = new Map(bars.map((b, i) => [b.time, i]));

  return blocks.map((block) => {
    const startIdx = timeIndex.get(block.formedAt);
    if (startIdx === undefined) return block;

    for (let i = startIdx + 1; i < bars.length; i++) {
      const bar = bars[i];
      if (block.type === "bearish") {
        if (bar.close > block.top) return { ...block, mitigated: true };
      } else if (bar.close < block.bottom) {
        return { ...block, mitigated: true };
      }
    }
    return block;
  });
}

/**
 * ICT-style rejection blocks: last opposing candle (open→extreme) after a
 * liquidity sweep of a swing high/low and a displacement in the reject direction.
 */
export function detectRejectionBlocks(bars: OhlcBar[]): RejectionBlock[] {
  const raw: RejectionBlock[] = [];

  for (let i = SWING_RADIUS + 1; i < bars.length; i++) {
    const bar = bars[i];
    const avgR = avgRange(bars, i);
    const minBody = avgR * DISPLACEMENT_BODY_RATIO;

    const swingHigh = nearestSwingHighBefore(bars, i);
    if (
      swingHigh != null &&
      bar.high > swingHigh &&
      bar.close < swingHigh &&
      hasBearishDisplacement(bars, i, minBody)
    ) {
      const rbIdx = lastBullishBefore(bars, i);
      if (rbIdx != null) {
        const rb = bars[rbIdx];
        const top = rb.high;
        const bottom = rb.open;
        if (top - bottom >= MIN_ZONE_PTS) {
          raw.push({
            id: `bear-rb-${rb.time}`,
            type: "bearish",
            top,
            bottom,
            mid: (top + bottom) / 2,
            formedAt: rb.time,
            mitigated: false,
          });
        }
      }
    }

    const swingLow = nearestSwingLowBefore(bars, i);
    if (
      swingLow != null &&
      bar.low < swingLow &&
      bar.close > swingLow &&
      hasBullishDisplacement(bars, i, minBody)
    ) {
      const rbIdx = lastBearishBefore(bars, i);
      if (rbIdx != null) {
        const rb = bars[rbIdx];
        const top = rb.open;
        const bottom = rb.low;
        if (top - bottom >= MIN_ZONE_PTS) {
          raw.push({
            id: `bull-rb-${rb.time}`,
            type: "bullish",
            top,
            bottom,
            mid: (top + bottom) / 2,
            formedAt: rb.time,
            mitigated: false,
          });
        }
      }
    }
  }

  const unique = new Map<string, RejectionBlock>();
  for (const block of raw) unique.set(block.id, block);

  return annotateMitigation([...unique.values()], bars);
}

function maxDistForSymbol(label: string, current: number): number {
  if (label === "GC") return Math.max(current * 0.012, 8);
  if (label === "ES") return Math.max(current * 0.012, 15);
  return Math.max(current * 0.015, 50);
}

/** Active rejection blocks near current price for the chart overlay. */
export function relevantRejectionBlocksForChart(
  blocks: RejectionBlock[],
  current: number,
  max: number,
  symbolLabel?: string
): RejectionBlock[] {
  if (max <= 0 || current <= 0) return [];

  const pool = blocks.filter((b) => !b.mitigated);
  const maxDist = maxDistForSymbol(symbolLabel ?? "NQ", current);

  const scored = pool
    .map((block) => {
      const dist = Math.min(
        Math.abs(block.top - current),
        Math.abs(block.bottom - current),
        Math.abs(block.mid - current)
      );
      const inside = current >= block.bottom && current <= block.top;
      return { block, dist, inside };
    })
    .sort(
      (a, b) =>
        (a.inside ? 0 : a.dist) - (b.inside ? 0 : b.dist) || a.dist - b.dist
    );

  const out: RejectionBlock[] = [];
  const seen = new Set<string>();

  for (const { block, dist, inside } of scored) {
    if (out.length >= max) break;
    if (!inside && dist > maxDist) continue;
    const key = `${Math.round(block.bottom)}-${Math.round(block.top)}-${block.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(block);
  }

  return out;
}
