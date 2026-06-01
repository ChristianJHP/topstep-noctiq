"use client";

import { useEffect } from "react";
import {
  alertTone,
  formatBiasShiftBody,
  formatBiasShiftTitle,
  type BiasShiftAlert,
} from "@/hooks/use-bias-shift-alerts";

type BiasShiftToastsProps = {
  alerts: BiasShiftAlert[];
  onDismiss: (id: string) => void;
};

const AUTO_DISMISS_MS = 16_000;

function biasGlyph(b: ReturnType<typeof alertTone>): string {
  if (b === "bullish") return "▲";
  if (b === "bearish") return "▼";
  return "◆";
}

function BiasShiftToastItem({
  alert,
  onDismiss,
}: {
  alert: BiasShiftAlert;
  onDismiss: (id: string) => void;
}) {
  const tone = alertTone(alert);

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(alert.id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [alert.id, alert.reason, alert.reasonLoading, onDismiss]);

  return (
    <div
      className={`bias-shift-toast bias-shift-toast--${tone}`}
      role="status"
    >
      <span className="bias-shift-glyph" aria-hidden>
        {biasGlyph(tone)}
      </span>
      <div className="bias-shift-copy">
        <p className="bias-shift-title">{formatBiasShiftTitle(alert)}</p>
        <p className="bias-shift-body">{formatBiasShiftBody(alert)}</p>
      </div>
      <button
        type="button"
        className="bias-shift-close"
        aria-label="Dismiss bias alert"
        onClick={() => onDismiss(alert.id)}
      >
        ×
      </button>
    </div>
  );
}

export function BiasShiftToasts({ alerts, onDismiss }: BiasShiftToastsProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="bias-shift-stack" aria-live="assertive" aria-relevant="additions">
      {alerts.map((alert) => (
        <BiasShiftToastItem key={alert.id} alert={alert} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
