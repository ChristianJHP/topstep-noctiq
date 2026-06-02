import type { Candle } from "@/lib/chart-data";
import { getZonedParts } from "@/lib/et-time";

const TZ = "America/New_York";
const SESSION_ROLLOVER_HOUR = 18;

export type DayChange = {
  pct: number;
  pts: number;
  reference: number;
};

/** Most recent 6PM ET — start of the current CME futures session day. */
export function futuresSessionDayStart(now = new Date()): Date {
  let probe = new Date(now);
  probe.setSeconds(0, 0);
  probe.setMinutes(Math.floor(probe.getMinutes() / 15) * 15);

  for (let i = 0; i < 200; i++) {
    const p = getZonedParts(probe, TZ);
    if (p.hour === SESSION_ROLLOVER_HOUR && p.minute === 0) {
      return probe;
    }
    probe = new Date(probe.getTime() - 15 * 60 * 1000);
  }

  return probe;
}

export function computeDayChange(
  candles: Candle[],
  current: number,
  now = new Date()
): DayChange | null {
  if (!candles.length || !Number.isFinite(current) || current <= 0) return null;

  const startSec = Math.floor(futuresSessionDayStart(now).getTime() / 1000);
  const sorted = [...candles].sort((a, b) => a.time - b.time);
  const after = sorted.filter((c) => c.time >= startSec);
  const before = sorted.filter((c) => c.time < startSec);

  let reference: number | null = null;
  if (after.length) reference = after[0].open;
  else if (before.length) reference = before[before.length - 1].close;

  if (reference == null || !Number.isFinite(reference) || reference <= 0) {
    return null;
  }

  const pts = Math.round((current - reference) * 100) / 100;
  const pct = Math.round(((current - reference) / reference) * 10000) / 100;
  return { pct, pts, reference };
}

export function formatDayChangePct(pct: number): string {
  const sign = pct > 0 ? "+" : pct < 0 ? "" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

/** Prior settlement day change — matches TradingView / Yahoo. */
export function dayChangeFromPriorClose(
  price: number,
  previousClose: number | null | undefined
): DayChange | null {
  if (!previousClose || previousClose <= 0 || !Number.isFinite(price)) {
    return null;
  }
  const pts = Math.round((price - previousClose) * 100) / 100;
  const pct =
    Math.round(((price - previousClose) / previousClose) * 10000) / 100;
  return { pct, pts, reference: previousClose };
}
