import type { OhlcBar } from "@/lib/ohlc-aggregate";

export type FvgTimeframe = "4H" | "1H";

export type FvgRespect = "respected" | "disrespected" | "untested";

export type FairValueGap = {
  id: string;
  type: "bullish" | "bearish";
  timeframe: FvgTimeframe;
  top: number;
  bottom: number;
  mid: number;
  formedAt: number;
  mitigated: boolean;
  respect: FvgRespect;
};

const MIN_GAP_PTS = 2;

function gapSize(top: number, bottom: number): number {
  return Math.abs(top - bottom);
}

function isBullishBar(bar: OhlcBar): boolean {
  return bar.close > bar.open;
}

function isBearishBar(bar: OhlcBar): boolean {
  return bar.close < bar.open;
}

/** All three candles in the FVG leg must be the same direction. */
function isThreeBullRun(bars: OhlcBar[], i: number): boolean {
  return (
    isBullishBar(bars[i - 2]) &&
    isBullishBar(bars[i - 1]) &&
    isBullishBar(bars[i])
  );
}

function isThreeBearRun(bars: OhlcBar[], i: number): boolean {
  return (
    isBearishBar(bars[i - 2]) &&
    isBearishBar(bars[i - 1]) &&
    isBearishBar(bars[i])
  );
}

/** 3-candle FVG with same-type candles only (3 bull or 3 bear in a row). */
export function detectFairValueGaps(
  bars: OhlcBar[],
  timeframe: FvgTimeframe
): FairValueGap[] {
  const out: FairValueGap[] = [];

  for (let i = 2; i < bars.length; i++) {
    const left = bars[i - 2];
    const right = bars[i];

    if (left.high < right.low && isThreeBullRun(bars, i)) {
      const bottom = left.high;
      const top = right.low;
      if (gapSize(top, bottom) >= MIN_GAP_PTS) {
        out.push({
          id: `${timeframe}-bull-${right.time}`,
          type: "bullish",
          timeframe,
          top,
          bottom,
          mid: (top + bottom) / 2,
          formedAt: right.time,
          mitigated: false,
          respect: "untested",
        });
      }
    }

    if (left.low > right.high && isThreeBearRun(bars, i)) {
      const top = left.low;
      const bottom = right.high;
      if (gapSize(top, bottom) >= MIN_GAP_PTS) {
        out.push({
          id: `${timeframe}-bear-${right.time}`,
          type: "bearish",
          timeframe,
          top,
          bottom,
          mid: (top + bottom) / 2,
          formedAt: right.time,
          mitigated: false,
          respect: "untested",
        });
      }
    }
  }

  return annotateFvgs(out, bars);
}

function annotateFvgs(fvgs: FairValueGap[], bars: OhlcBar[]): FairValueGap[] {
  const timeIndex = new Map(bars.map((b, i) => [b.time, i]));

  return fvgs.map((fvg) => {
    const startIdx = timeIndex.get(fvg.formedAt);
    if (startIdx === undefined) return fvg;

    let mitigated = false;
    let respect: FvgRespect = "untested";

    for (let i = startIdx + 1; i < bars.length; i++) {
      const bar = bars[i];

      if (fvg.type === "bullish") {
        if (bar.low <= fvg.bottom) {
          mitigated = true;
          respect = "disrespected";
          break;
        }
        if (bar.low <= fvg.top && bar.close >= fvg.bottom) {
          respect = "respected";
        }
        if (bar.close < fvg.bottom) {
          respect = "disrespected";
        }
      } else {
        if (bar.high >= fvg.top) {
          mitigated = true;
          respect = "disrespected";
          break;
        }
        if (bar.high >= fvg.bottom && bar.close <= fvg.top) {
          respect = "respected";
        }
        if (bar.close > fvg.top) {
          respect = "disrespected";
        }
      }
    }

    return { ...fvg, mitigated, respect };
  });
}

export type FvgBiasScore = {
  bullRespected: number;
  bullDisrespected: number;
  bearRespected: number;
  bearDisrespected: number;
  net: number;
};

export function scoreFvgBias(fvgs: FairValueGap[]): FvgBiasScore {
  const recent = fvgs.slice(-16);
  let bullRespected = 0;
  let bullDisrespected = 0;
  let bearRespected = 0;
  let bearDisrespected = 0;

  for (const fvg of recent) {
    if (fvg.type === "bullish") {
      if (fvg.respect === "respected") bullRespected++;
      if (fvg.respect === "disrespected") bullDisrespected++;
    } else {
      if (fvg.respect === "respected") bearRespected++;
      if (fvg.respect === "disrespected") bearDisrespected++;
    }
  }

  const net =
    bullRespected +
    bearDisrespected -
    bullDisrespected -
    bearRespected;

  return {
    bullRespected,
    bullDisrespected,
    bearRespected,
    bearDisrespected,
    net,
  };
}

export function activeFvgsForChart(
  fvgs: FairValueGap[],
  max = 2
): FairValueGap[] {
  return fvgs
    .filter((f) => !f.mitigated && f.respect !== "disrespected")
    .slice(-max);
}

/** Active FVGs near current price — untested/respected gaps that matter for the chart. */
export function relevantFvgsForChart(
  fvgs: FairValueGap[],
  current: number,
  max: number,
  symbolLabel?: string
): FairValueGap[] {
  if (max <= 0 || current <= 0) return [];

  const pool = fvgs.filter(
    (f) => !f.mitigated && f.respect !== "disrespected"
  );
  const minDist =
    symbolLabel === "GC" ? 8 : symbolLabel === "ES" ? 15 : 50;
  const maxDist = Math.max(current * 0.012, minDist);

  const scored = pool
    .map((fvg) => {
      const dist = Math.min(
        Math.abs(fvg.top - current),
        Math.abs(fvg.bottom - current),
        Math.abs(fvg.mid - current)
      );
      const inside = current >= fvg.bottom && current <= fvg.top;
      const priority =
        (inside ? 0 : dist) + (fvg.respect === "untested" ? -500 : 0);
      return { fvg, dist, inside, priority };
    })
    .sort((a, b) => a.priority - b.priority || a.dist - b.dist);

  const out: FairValueGap[] = [];
  const seen = new Set<string>();

  for (const { fvg, dist, inside } of scored) {
    if (out.length >= max) break;
    if (!inside && dist > maxDist) continue;
    const key = `${Math.round(fvg.bottom)}-${Math.round(fvg.top)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(fvg);
  }

  return out;
}

export function nearestSwingHigh(bars: OhlcBar[], lookback = 12): number {
  const slice = bars.slice(-lookback);
  return Math.max(...slice.map((b) => b.high));
}

export function nearestSwingLow(bars: OhlcBar[], lookback = 12): number {
  const slice = bars.slice(-lookback);
  return Math.min(...slice.map((b) => b.low));
}

export type CisdLevel = {
  type: "bullish" | "bearish";
  price: number;
  timeframe: FvgTimeframe;
};

/** Body close through opening price of down/up series into a gap or swing. */
export function detectCisd(
  bars: OhlcBar[],
  fvgs: FairValueGap[],
  timeframe: FvgTimeframe
): CisdLevel | null {
  if (bars.length < 5) return null;

  const keyLevels = [
    ...fvgs.filter((f) => !f.mitigated).map((f) => f.mid),
    nearestSwingLow(bars, 8),
    nearestSwingHigh(bars, 8),
  ];

  for (let i = bars.length - 2; i >= 2; i--) {
    const bullish = detectBullishCisdAt(bars, i, keyLevels);
    if (bullish) return { ...bullish, timeframe };

    const bearish = detectBearishCisdAt(bars, i, keyLevels);
    if (bearish) return { ...bearish, timeframe };
  }

  return null;
}

function nearLevel(price: number, levels: number[], tolerance: number): boolean {
  return levels.some((l) => Math.abs(price - l) <= tolerance);
}

function detectBullishCisdAt(
  bars: OhlcBar[],
  endIdx: number,
  keyLevels: number[]
): Omit<CisdLevel, "timeframe"> | null {
  let start = endIdx;
  while (start > 0 && bars[start].close < bars[start].open) {
    start--;
  }
  start++;

  if (endIdx - start < 0) return null;

  const tol = Math.max(4, (bars[endIdx].high - bars[endIdx].low) * 0.5);
  const series = bars.slice(start, endIdx + 1);
  const tradedInto = series.some(
    (b) => nearLevel(b.low, keyLevels, tol) || nearLevel(b.close, keyLevels, tol)
  );
  if (!tradedInto) return null;

  const cisdOpen = bars[start].open;

  for (let j = endIdx + 1; j < bars.length; j++) {
    if (bars[j].close > cisdOpen) {
      return { type: "bullish", price: cisdOpen };
    }
  }

  return null;
}

function detectBearishCisdAt(
  bars: OhlcBar[],
  endIdx: number,
  keyLevels: number[]
): Omit<CisdLevel, "timeframe"> | null {
  let start = endIdx;
  while (start > 0 && bars[start].close > bars[start].open) {
    start--;
  }
  start++;

  if (endIdx - start < 0) return null;

  const tol = Math.max(4, (bars[endIdx].high - bars[endIdx].low) * 0.5);
  const series = bars.slice(start, endIdx + 1);
  const tradedInto = series.some(
    (b) => nearLevel(b.high, keyLevels, tol) || nearLevel(b.close, keyLevels, tol)
  );
  if (!tradedInto) return null;

  const cisdOpen = bars[start].open;

  for (let j = endIdx + 1; j < bars.length; j++) {
    if (bars[j].close < cisdOpen) {
      return { type: "bearish", price: cisdOpen };
    }
  }

  return null;
}
