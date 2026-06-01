"use client";

import { useEffect } from "react";
import type { CandleCloseAlert } from "@/hooks/use-candle-close-alerts";

type CandleCloseToastsProps = {
  alerts: CandleCloseAlert[];
  onDismiss: (id: string) => void;
};

const AUTO_DISMISS_MS = 8000;

function CandleCloseToastItem({
  alert,
  onDismiss,
}: {
  alert: CandleCloseAlert;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(alert.id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [alert.id, onDismiss]);

  return (
    <div className="candle-close-toast" role="status">
      <span className="candle-close-toast-k">{alert.interval}</span>
      <p className="candle-close-toast-v">Candle closed</p>
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

export function CandleCloseToasts({ alerts, onDismiss }: CandleCloseToastsProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="candle-close-stack" aria-live="polite">
      {alerts.map((alert) => (
        <CandleCloseToastItem
          key={alert.id}
          alert={alert}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}
