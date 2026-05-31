const TZ = "America/New_York";

export type CandleInterval = "1H" | "4H";

export interface CandleCountdown {
  interval: CandleInterval;
  closesAt: Date;
  remainingMs: number;
}

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(
    parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value])
  );
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** Wall-clock instant for a given ET calendar moment (DST-aware). */
function etToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour + 5, minute, second));
  const parts = getZonedParts(guess, TZ);
  const displayed = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  return new Date(guess.getTime() + (target - displayed));
}

export function getNextCandleClose(
  interval: CandleInterval,
  now = new Date()
): CandleCountdown {
  const p = getZonedParts(now, TZ);

  if (interval === "1H") {
    const nextHour = p.hour + 1;
    const day = nextHour >= 24 ? p.day + 1 : p.day;
    const hour = nextHour % 24;
    const closesAt = etToUtc(p.year, p.month, day, hour, 0, 0);
    return { interval, closesAt, remainingMs: Math.max(0, closesAt.getTime() - now.getTime()) };
  }

  const boundaries = [0, 4, 8, 12, 16, 20];
  let nextBoundary = boundaries.find((b) => b > p.hour);
  let day = p.day;
  let hour: number;

  if (nextBoundary === undefined) {
    nextBoundary = boundaries[0];
    day += 1;
    hour = nextBoundary;
  } else {
    hour = nextBoundary;
  }

  const closesAt = etToUtc(p.year, p.month, day, hour, 0, 0);
  return { interval, closesAt, remainingMs: Math.max(0, closesAt.getTime() - now.getTime()) };
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Human-readable countdown: `48m`, `13h 22m`, `2d 5h` */
export function formatCountdownHuman(ms: number): string {
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
  return getZonedParts(date, TZ).hour;
}

export function getCandleCountdowns(now = new Date()) {
  return {
    fourHour: getNextCandleClose("4H", now),
    oneHour: getNextCandleClose("1H", now),
  };
}
