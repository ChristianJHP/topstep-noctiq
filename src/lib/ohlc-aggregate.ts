import type { Candle } from "@/lib/chart-data";
import { getZonedHourEt } from "@/lib/candle-timers";

export interface OhlcBar {
  open: number;
  high: number;
  low: number;
  close: number;
  bucketKey: string;
  /** Unix seconds for chart time scale */
  time: number;
}

function getFourHourBucket(timeSec: number): number {
  const hour = getZonedHourEt(new Date(timeSec * 1000));
  return Math.floor(hour / 4);
}

function getDayKey(timeSec: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timeSec * 1000));
}

export function aggregateBars(
  candles: Candle[],
  bucketFn: (timeSec: number) => string
): OhlcBar[] {
  const map = new Map<string, OhlcBar & { firstTime: number }>();

  for (const c of candles) {
    const key = bucketFn(c.time);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        bucketKey: key,
        time: c.time,
        firstTime: c.time,
      });
    } else {
      existing.high = Math.max(existing.high, c.high);
      existing.low = Math.min(existing.low, c.low);
      existing.close = c.close;
    }
  }

  return [...map.values()]
    .sort((a, b) => a.bucketKey.localeCompare(b.bucketKey))
    .map(({ firstTime: _f, ...bar }) => bar);
}

export function aggregate4h(candles: Candle[]): OhlcBar[] {
  return aggregateBars(candles, (t) => {
    const day = getDayKey(t);
    return `${day}-${getFourHourBucket(t)}`;
  });
}

export function aggregate1h(candles: Candle[]): OhlcBar[] {
  return aggregateBars(candles, (t) => {
    const day = getDayKey(t);
    const hour = getZonedHourEt(new Date(t * 1000));
    return `${day}-${hour}`;
  });
}
