import { getZonedParts } from "@/lib/et-time";
import * as futuresMarket from "./futuresMarket";

const TZ = "America/New_York";

export type MarketSession = {
  isOpen: boolean;
  reason: string;
  minutesUntilOpen: number | null;
  minutesUntilClose: number | null;
  minutesTo1HClose: number | null;
  minutesTo4HClose: number | null;
};

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

/** Minutes until next 1H boundary while session is open (caps at 5pm ET break). */
export function getMinutesToNext1HClose(now = new Date()): number | null {
  const status = futuresMarket.isFuturesOpen();
  if (!status.open) return null;

  const p = getZonedParts(now, TZ);
  const currentMins = p.hour * 60 + p.minute;
  const day = getEtWeekday(now);

  let nextBoundaryMins = (p.hour + 1) * 60;

  if (day >= 1 && day <= 4) {
    nextBoundaryMins = Math.min(nextBoundaryMins, 17 * 60);
  } else if (day === 5) {
    nextBoundaryMins = Math.min(nextBoundaryMins, 17 * 60);
  }

  if (currentMins >= nextBoundaryMins) return null;

  return Math.max(1, nextBoundaryMins - currentMins);
}

/** Minutes until next 4H boundary (0/4/8/12/16/20 ET) while session is open. */
export function getMinutesToNext4HClose(now = new Date()): number | null {
  const status = futuresMarket.isFuturesOpen();
  if (!status.open) return null;

  const p = getZonedParts(now, TZ);
  const currentMins = p.hour * 60 + p.minute;
  const day = getEtWeekday(now);
  const boundaries = [0, 4, 8, 12, 16, 20].map((h) => h * 60);
  let next = boundaries.find((b) => b > currentMins);

  if (next === undefined) {
    next = 24 * 60;
  }

  if (day >= 1 && day <= 4) {
    next = Math.min(next, 17 * 60);
  } else if (day === 5) {
    next = Math.min(next, 17 * 60);
  }

  if (currentMins >= next) return null;

  return Math.max(1, next - currentMins);
}

export function getMarketSession(now = new Date()): MarketSession {
  const status = futuresMarket.isFuturesOpen();

  if (!status.open) {
    const untilOpen = futuresMarket.getTimeUntilOpen();
    const minutesUntilOpen =
      untilOpen.hoursUntilOpen * 60 + untilOpen.minutesUntilOpen;

    return {
      isOpen: false,
      reason: status.reason,
      minutesUntilOpen: minutesUntilOpen > 0 ? minutesUntilOpen : null,
      minutesUntilClose: null,
      minutesTo1HClose: null,
      minutesTo4HClose: null,
    };
  }

  const untilClose = futuresMarket.getTimeUntilClose();
  const minutesUntilClose =
    untilClose.hoursUntilClose * 60 + untilClose.minutesUntilClose;

  return {
    isOpen: true,
    reason: status.reason,
    minutesUntilOpen: null,
    minutesUntilClose: minutesUntilClose > 0 ? minutesUntilClose : null,
    minutesTo1HClose: getMinutesToNext1HClose(now),
    minutesTo4HClose: getMinutesToNext4HClose(now),
  };
}

export function isFuturesSessionOpen(): boolean {
  return futuresMarket.isFuturesOpen().open;
}
