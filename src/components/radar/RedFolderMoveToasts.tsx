"use client";

import { useEffect } from "react";
import type { RedFolderMoveAlert } from "@/hooks/use-red-folder-move-alerts";

type RedFolderMoveToastsProps = {
  alerts: RedFolderMoveAlert[];
  onDismiss: (id: string) => void;
};

const AUTO_DISMISS_MS = 20_000;

function RedFolderMoveToastItem({
  alert,
  onDismiss,
}: {
  alert: RedFolderMoveAlert;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(
      () => onDismiss(alert.id),
      AUTO_DISMISS_MS
    );
    return () => window.clearTimeout(timer);
  }, [alert.id, onDismiss]);

  return (
    <div className="red-folder-move-toast" role="alert">
      <span className="red-folder-move-glyph" aria-hidden>
        ■
      </span>
      <div className="red-folder-move-copy">
        <p className="red-folder-move-title">{alert.event.title}</p>
        <p className="red-folder-move-body">
          NQ {alert.move.rangePts}pt ·{" "}
          {Math.max(0, Math.round(alert.move.delayMs / 1000))}s after release
        </p>
      </div>
      <button
        type="button"
        className="bias-shift-close"
        aria-label="Dismiss"
        onClick={() => onDismiss(alert.id)}
      >
        ×
      </button>
    </div>
  );
}

export function RedFolderMoveToasts({
  alerts,
  onDismiss,
}: RedFolderMoveToastsProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="red-folder-move-stack" aria-live="assertive">
      {alerts.map((alert) => (
        <RedFolderMoveToastItem
          key={alert.id}
          alert={alert}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}
