import type { EconomicEvent } from "@/lib/events";

/** NQ points — live range from release through first ~3 minutes. */
export const RED_FOLDER_MOVE_MIN_PTS = 30;

/** Warm up polling before release. */
export const RED_FOLDER_MONITOR_PRE_MS = 60 * 1000;

/** Stop watching after this post-release. */
export const RED_FOLDER_MONITOR_POST_MS = 4 * 60 * 1000;

/** Must alert within this many ms of the move forming. */
export const RED_FOLDER_MAX_ALERT_DELAY_MS = 30_000;

/** Poll every 500ms during critical release window. */
export const RED_FOLDER_CRITICAL_POLL_MS = 500;

/** Poll every 2s while on standby before release. */
export const RED_FOLDER_WARM_POLL_MS = 2_000;

export type RedFolderMoveHit = {
  rangePts: number;
  /** Ms after scheduled release when move threshold was hit. */
  delayMs: number;
};

export type LiveMoveTracker = {
  high: number;
  low: number;
  active: boolean;
  /** When range first crossed threshold. */
  moveAtMs: number | null;
};

export function eventAlertKey(event: EconomicEvent): string {
  return `${event.title}|${event.scheduledAt}`;
}

export function releaseMs(event: EconomicEvent): number {
  return new Date(event.scheduledAt).getTime();
}

export function isRedFolderMonitoringWindow(
  event: EconomicEvent,
  now: number
): boolean {
  const t = releaseMs(event);
  return now >= t - RED_FOLDER_MONITOR_PRE_MS && now <= t + RED_FOLDER_MONITOR_POST_MS;
}

export function isCriticalReleaseWindow(
  event: EconomicEvent,
  now: number
): boolean {
  const t = releaseMs(event);
  return now >= t - 5_000 && now <= t + 3 * 60 * 1000;
}

export function shouldTrackLiveMove(
  event: EconomicEvent,
  now: number
): boolean {
  const t = releaseMs(event);
  return now >= t - 1_000 && now <= t + 3 * 60 * 1000;
}

export function pollIntervalMs(events: EconomicEvent[], now: number): number | null {
  if (events.length === 0) return null;
  if (events.some((e) => isCriticalReleaseWindow(e, now))) {
    return RED_FOLDER_CRITICAL_POLL_MS;
  }
  if (events.some((e) => isRedFolderMonitoringWindow(e, now))) {
    return RED_FOLDER_WARM_POLL_MS;
  }
  return null;
}

export function createLiveTracker(): LiveMoveTracker {
  return { high: -Infinity, low: Infinity, active: false, moveAtMs: null };
}

export function updateLiveTracker(
  tracker: LiveMoveTracker,
  price: number,
  barHigh?: number,
  barLow?: number,
  now = Date.now()
): number {
  const pts = [price, barHigh, barLow].filter(
    (p): p is number => p != null && Number.isFinite(p) && p > 0
  );
  if (pts.length === 0) return 0;

  if (!tracker.active) {
    tracker.high = Math.max(...pts);
    tracker.low = Math.min(...pts);
    tracker.active = true;
  } else {
    tracker.high = Math.max(tracker.high, ...pts);
    tracker.low = Math.min(tracker.low, ...pts);
  }

  const range = tracker.high - tracker.low;
  if (range >= RED_FOLDER_MOVE_MIN_PTS && tracker.moveAtMs == null) {
    tracker.moveAtMs = now;
  }

  return range;
}

export function liveMoveHit(
  event: EconomicEvent,
  tracker: LiveMoveTracker,
  now: number
): RedFolderMoveHit | null {
  if (!tracker.active || tracker.moveAtMs == null) return null;

  const rangePts = tracker.high - tracker.low;
  if (rangePts < RED_FOLDER_MOVE_MIN_PTS) return null;

  const delayMs = tracker.moveAtMs - releaseMs(event);
  const alertDelayMs = now - tracker.moveAtMs;
  if (alertDelayMs > RED_FOLDER_MAX_ALERT_DELAY_MS) return null;

  return {
    rangePts: Math.round(rangePts * 10) / 10,
    delayMs: Math.max(0, delayMs),
  };
}

/** Reject quotes that are too stale to trust for fast alerts. */
export function isQuoteFresh(quoteTimeSec: number, nowMs: number): boolean {
  const ageMs = nowMs - quoteTimeSec * 1000;
  return ageMs >= 0 && ageMs <= 15_000;
}
