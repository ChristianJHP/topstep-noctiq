import {
  getMarketSession,
  isFuturesSessionOpen,
} from "@/lib/futures-session";
import {
  getZonedHourEt as getZonedHourEtFromEtTime,
  getZonedParts,
} from "@/lib/et-time";

export { getZonedParts } from "@/lib/et-time";

const TZ = "America/New_York";

export type CandleInterval = "15M" | "1H" | "4H";

export interface CandleCountdown {
  interval: CandleInterval;
  closesAt: Date | null;
  remainingMs: number | null;
  paused: boolean;
  pauseReason?: string;
}

function getEtWeekday(now: Date): number {
  const label = now.toLocaleDateString("en-US", {
    timeZone: TZ,
    weekday: "short",
  });
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[label] ?? 0;
}

function weekdayCloseCapSec(day: number, currentSec: number): number | null {
  if (day >= 1 && day <= 5) {
    const cap = 17 * 3600;
    if (currentSec >= cap) return null;
    return cap;
  }
  return null;
}

function intervalStepSec(interval: CandleInterval): number {
  if (interval === "15M") return 15 * 60;
  if (interval === "1H") return 60 * 60;
  return 4 * 60 * 60;
}

function msToNextBoundary(interval: CandleInterval, now: Date): number | null {
  if (!isFuturesSessionOpen()) return null;

  const p = getZonedParts(now, TZ);
  const day = getEtWeekday(now);
  const currentSec = p.hour * 3600 + p.minute * 60 + p.second;
  const cap = weekdayCloseCapSec(day, currentSec);

  let nextSec: number;
  if (interval === "4H") {
    const boundaries = [0, 4, 8, 12, 16, 20].map((h) => h * 3600);
    nextSec = boundaries.find((b) => b > currentSec) ?? 24 * 3600;
  } else {
    const step = intervalStepSec(interval);
    nextSec = Math.floor(currentSec / step) * step + step;
  }

  if (cap != null) {
    nextSec = Math.min(nextSec, cap);
  }

  if (currentSec >= nextSec) return null;

  return (nextSec - currentSec) * 1000;
}

export function getNextCandleClose(
  interval: CandleInterval,
  now = new Date()
): CandleCountdown {
  const session = getMarketSession(now);

  if (!session.isOpen) {
    return {
      interval,
      closesAt: null,
      remainingMs: null,
      paused: true,
      pauseReason: session.reason,
    };
  }

  const remainingMs = msToNextBoundary(interval, now);

  if (remainingMs == null) {
    return {
      interval,
      closesAt: null,
      remainingMs: null,
      paused: true,
      pauseReason: session.reason,
    };
  }

  return {
    interval,
    closesAt: new Date(now.getTime() + remainingMs),
    remainingMs,
    paused: false,
  };
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Human-readable countdown: `48m`, `13h 22m`, `2d 5h` */
export function formatCountdownHuman(ms: number | null): string {
  if (ms == null) return "—";
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);

  if (h >= 24) {
    const days = Math.floor(h / 24);
    const remH = h % 24;
    return remH > 0 ? `${days}d ${remH}h ${m}m` : `${days}d ${m}m`;
  }

  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "<1m";
}

/** Live candle countdown — always shows minutes; seconds under 1h. */
export function formatCandleCountdown(ms: number | null): string {
  if (ms == null) return "—";
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function getZonedHourEt(date: Date): number {
  return getZonedHourEtFromEtTime(date, TZ);
}

export function getCandleCountdowns(now = new Date()) {
  return {
    fifteenMin: getNextCandleClose("15M", now),
    oneHour: getNextCandleClose("1H", now),
    fourHour: getNextCandleClose("4H", now),
  };
}
