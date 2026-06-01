import type { OhlcBar } from "@/lib/ohlc-aggregate";
import { getZonedParts } from "@/lib/et-time";
import {
  getActiveSessionBlock,
  isMinuteInSessionBlock,
  type SessionBlock,
} from "@/lib/trading-session";

const TZ = "America/New_York";

export type CurrentSessionRange = {
  high: number;
  low: number;
  label: string;
};

type EtParts = ReturnType<typeof getZonedParts>;

function etDateKey(p: EtParts): string {
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function shiftEtDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d + days, 12);
  const p = getZonedParts(new Date(utc), TZ);
  return etDateKey(p);
}

function etMinutesFromParts(p: EtParts): number {
  return p.hour * 60 + p.minute;
}

/** Whether a bar belongs to the same session instance as `now`. */
export function barInCurrentSession(
  barTimeSec: number,
  now: Date,
  block: SessionBlock
): boolean {
  const barP = getZonedParts(new Date(barTimeSec * 1000), TZ);
  const nowP = getZonedParts(now, TZ);
  const barMins = etMinutesFromParts(barP);
  const nowMins = etMinutesFromParts(nowP);

  if (!isMinuteInSessionBlock(barMins, block)) return false;

  if (block.wrap) {
    if (nowMins >= block.start) {
      return (
        barP.year === nowP.year &&
        barP.month === nowP.month &&
        barP.day === nowP.day &&
        barMins >= block.start
      );
    }

    const nowDate = etDateKey(nowP);
    const prevDate = shiftEtDateKey(nowDate, -1);
    const barDate = etDateKey(barP);
    if (barDate === prevDate && barMins >= block.start) return true;
    if (barDate === nowDate && barMins < block.end) return true;
    return false;
  }

  return (
    barP.year === nowP.year &&
    barP.month === nowP.month &&
    barP.day === nowP.day
  );
}

/** High/low of the active ET session from chart bars. */
export function currentSessionHighLow(
  bars: OhlcBar[],
  now = new Date()
): CurrentSessionRange | null {
  const block = getActiveSessionBlock(now);
  if (!block || !bars.length) return null;

  const inSession = bars.filter((b) => barInCurrentSession(b.time, now, block));
  if (!inSession.length) return null;

  return {
    high: Math.max(...inSession.map((b) => b.high)),
    low: Math.min(...inSession.map((b) => b.low)),
    label: block.label,
  };
}
