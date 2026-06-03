import type { AlertSettings } from "@/lib/alert-settings";
import { playAlertSound } from "@/lib/alert-sound";

export function maybePlayAlertSound(settings: AlertSettings) {
  if (settings.soundEnabled) playAlertSound();
}

export function maybeFireBrowserNotification(
  settings: AlertSettings,
  title: string,
  body: string,
  tag: string
) {
  if (!settings.browserNotifications) return;
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return;
  }
  if (Notification.permission !== "granted") return;

  try {
    new Notification(title, { body, icon: "/icon.svg", tag });
  } catch {
    /* Safari / restricted contexts */
  }
}

export async function requestBrowserNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported";
  }
  if (Notification.permission !== "default") {
    return Notification.permission;
  }
  return Notification.requestPermission();
}
