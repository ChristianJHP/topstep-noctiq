"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_ALERT_SETTINGS,
  readAlertSettings,
  writeAlertSettings,
  type AlertSettings,
} from "@/lib/alert-settings";
import { requestBrowserNotificationPermission } from "@/lib/alert-notify";
import type { CandleInterval } from "@/lib/candle-timers";

export function useAlertSettings() {
  const [settings, setSettings] = useState<AlertSettings>(DEFAULT_ALERT_SETTINGS);
  const [notifyPermission, setNotifyPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");

  useEffect(() => {
    setSettings(readAlertSettings());
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      setNotifyPermission("unsupported");
      return;
    }
    setNotifyPermission(Notification.permission);
  }, []);

  const persist = useCallback((next: AlertSettings) => {
    writeAlertSettings(next);
    setSettings(next);
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<AlertSettings>) => {
      persist({ ...readAlertSettings(), ...patch });
    },
    [persist]
  );

  const setBiasShifts = useCallback(
    (enabled: boolean) => updateSettings({ biasShifts: enabled }),
    [updateSettings]
  );

  const setRedFolderMoves = useCallback(
    (enabled: boolean) => updateSettings({ redFolderMoves: enabled }),
    [updateSettings]
  );

  const setSoundEnabled = useCallback(
    (enabled: boolean) => updateSettings({ soundEnabled: enabled }),
    [updateSettings]
  );

  const setBrowserNotifications = useCallback(
    (enabled: boolean) => updateSettings({ browserNotifications: enabled }),
    [updateSettings]
  );

  const toggleCandleClose = useCallback(
    (interval: CandleInterval) => {
      const current = readAlertSettings();
      persist({
        ...current,
        candleClose: {
          ...current.candleClose,
          [interval]: !current.candleClose[interval],
        },
      });
    },
    [persist]
  );

  const requestBrowserNotifications = useCallback(async () => {
    const result = await requestBrowserNotificationPermission();
    setNotifyPermission(result);
    if (result === "granted") {
      updateSettings({ browserNotifications: true });
    }
    return result;
  }, [updateSettings]);

  return {
    settings,
    notifyPermission,
    updateSettings,
    setBiasShifts,
    setRedFolderMoves,
    setSoundEnabled,
    setBrowserNotifications,
    toggleCandleClose,
    requestBrowserNotifications,
  };
}
