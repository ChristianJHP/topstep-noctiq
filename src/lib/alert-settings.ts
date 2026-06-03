import type { CandleInterval } from "@/lib/candle-timers";

export type AlertSettings = {
  biasShifts: boolean;
  candleClose: Record<CandleInterval, boolean>;
  redFolderMoves: boolean;
  soundEnabled: boolean;
  browserNotifications: boolean;
};

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  biasShifts: false,
  candleClose: { "15M": false, "1H": false, "4H": false },
  redFolderMoves: true,
  soundEnabled: false,
  browserNotifications: false,
};

const STORAGE_KEY = "jhptrades-alert-settings-v1";
const LEGACY_BIAS_KEY = "jhptrades-bias-alerts-enabled";
const LEGACY_CANDLE_KEY = "jhptrades-candle-close-alerts";

export function readAlertSettings(): AlertSettings {
  if (typeof window === "undefined") return DEFAULT_ALERT_SETTINGS;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AlertSettings>;
      return {
        ...DEFAULT_ALERT_SETTINGS,
        ...parsed,
        candleClose: {
          ...DEFAULT_ALERT_SETTINGS.candleClose,
          ...parsed.candleClose,
        },
      };
    }
  } catch {
    /* fall through to legacy migration */
  }

  let biasShifts = false;
  let browserNotifications = false;
  try {
    const legacyBias = localStorage.getItem(LEGACY_BIAS_KEY) === "true";
    biasShifts = legacyBias;
    browserNotifications = legacyBias;
  } catch {
    /* ignore */
  }

  let candleClose = { ...DEFAULT_ALERT_SETTINGS.candleClose };
  try {
    const raw = localStorage.getItem(LEGACY_CANDLE_KEY);
    if (raw) {
      candleClose = {
        ...candleClose,
        ...(JSON.parse(raw) as Partial<Record<CandleInterval, boolean>>),
      };
    }
  } catch {
    /* ignore */
  }

  return {
    ...DEFAULT_ALERT_SETTINGS,
    biasShifts,
    browserNotifications,
    candleClose,
  };
}

export function writeAlertSettings(settings: AlertSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore quota */
  }
}

export function anyAlertsEnabled(settings: AlertSettings): boolean {
  return (
    settings.biasShifts ||
    settings.redFolderMoves ||
    settings.candleClose["15M"] ||
    settings.candleClose["1H"] ||
    settings.candleClose["4H"]
  );
}
