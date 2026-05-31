import { getMarketSession } from "@/lib/futures-session";
import { getZonedHourEt as getZonedHourEtFromEtTime } from "@/lib/et-time";

export { getZonedParts } from "@/lib/et-time";

const TZ = "America/New_York";

export type CandleInterval = "1H" | "4H";

export interface CandleCountdown {
  interval: CandleInterval;
  closesAt: Date | null;
  remainingMs: number | null;
  paused: boolean;
  pauseReason?: string;
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

  const minutes =
    interval === "1H" ? session.minutesTo1HClose : session.minutesTo4HClose;

  if (minutes == null) {
    return {
      interval,
      closesAt: null,
      remainingMs: null,
      paused: true,
      pauseReason: session.reason,
    };
  }

  const remainingMs = minutes * 60_000;
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
    return remH > 0 ? `${days}d ${remH}h` : `${days}d`;
  }

  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return "<1m";
}

export function getZonedHourEt(date: Date): number {
  return getZonedHourEtFromEtTime(date, TZ);
}

export function getCandleCountdowns(now = new Date()) {
  return {
    fourHour: getNextCandleClose("4H", now),
    oneHour: getNextCandleClose("1H", now),
  };
}
