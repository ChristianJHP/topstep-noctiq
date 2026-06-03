"use client";

import { useEffect, useRef } from "react";
import type { CandleInterval } from "@/lib/candle-timers";
import type { AlertSettings } from "@/lib/alert-settings";
import { anyAlertsEnabled } from "@/lib/alert-settings";

const CANDLE_INTERVALS: CandleInterval[] = ["15M", "1H", "4H"];

type AlertSettingsPanelProps = {
  open: boolean;
  onClose: () => void;
  settings: AlertSettings;
  notifyPermission: NotificationPermission | "unsupported";
  onSetBiasShifts: (enabled: boolean) => void;
  onToggleCandleClose: (interval: CandleInterval) => void;
  onSetRedFolderMoves: (enabled: boolean) => void;
  onSetSoundEnabled: (enabled: boolean) => void;
  onSetBrowserNotifications: (enabled: boolean) => void;
  onRequestBrowserNotifications: () => void | Promise<unknown>;
};

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="alert-settings-row">
      <span className="alert-settings-row-copy">
        <span className="alert-settings-row-label">{label}</span>
        {hint ? <span className="alert-settings-row-hint">{hint}</span> : null}
      </span>
      <input
        type="checkbox"
        className="alert-settings-toggle"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function AlertSettingsButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`mr-alert-settings-btn${active ? " mr-alert-settings-btn--active" : ""}`}
      onClick={onClick}
      aria-label="Alert settings"
      title="Alert settings"
    >
      Alerts
    </button>
  );
}

export function AlertSettingsPanel({
  open,
  onClose,
  settings,
  notifyPermission,
  onSetBiasShifts,
  onToggleCandleClose,
  onSetRedFolderMoves,
  onSetSoundEnabled,
  onSetBrowserNotifications,
  onRequestBrowserNotifications,
}: AlertSettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const notifyBlocked = notifyPermission === "denied";
  const notifyUnsupported = notifyPermission === "unsupported";

  return (
    <>
      <button
        type="button"
        className="alert-settings-backdrop"
        aria-label="Close alert settings"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="alert-settings-panel"
        role="dialog"
        aria-labelledby="alert-settings-title"
      >
        <header className="alert-settings-head">
          <h2 id="alert-settings-title" className="alert-settings-title">
            Alert settings
          </h2>
          <button
            type="button"
            className="alert-settings-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="alert-settings-body">
          <section className="alert-settings-section">
            <h3 className="alert-settings-section-k">Bias</h3>
            <ToggleRow
              label="HTF bias shifts"
              hint="NQ, ES, Gold when 1H/4H context changes"
              checked={settings.biasShifts}
              onChange={onSetBiasShifts}
            />
          </section>

          <section className="alert-settings-section">
            <h3 className="alert-settings-section-k">Candle closes</h3>
            <div className="alert-settings-chip-row">
              {CANDLE_INTERVALS.map((interval) => {
                const on = settings.candleClose[interval];
                return (
                  <button
                    key={interval}
                    type="button"
                    className={`alert-settings-chip${on ? " alert-settings-chip--on" : ""}`}
                    aria-pressed={on}
                    onClick={() => onToggleCandleClose(interval)}
                  >
                    {interval}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="alert-settings-section">
            <h3 className="alert-settings-section-k">News</h3>
            <ToggleRow
              label="Red folder moves"
              hint="Large NQ range after economic releases"
              checked={settings.redFolderMoves}
              onChange={onSetRedFolderMoves}
            />
          </section>

          <section className="alert-settings-section">
            <h3 className="alert-settings-section-k">Delivery</h3>
            <ToggleRow
              label="Sound"
              hint="Short beep when an alert fires"
              checked={settings.soundEnabled}
              onChange={onSetSoundEnabled}
            />
            <ToggleRow
              label="Browser notifications"
              hint="OS-level popups when this tab is in the background"
              checked={settings.browserNotifications}
              onChange={(next) => {
                if (next && notifyPermission === "default") {
                  void onRequestBrowserNotifications();
                  return;
                }
                onSetBrowserNotifications(next);
              }}
            />
            {notifyBlocked ? (
              <p className="alert-settings-note alert-settings-note--warn">
                Notifications blocked in browser settings.
              </p>
            ) : null}
            {notifyUnsupported ? (
              <p className="alert-settings-note">Browser notifications unavailable.</p>
            ) : null}
          </section>
        </div>

        <footer className="alert-settings-foot">
          <span className="alert-settings-foot-meta">
            {anyAlertsEnabled(settings) ? "Some alerts on" : "All alerts off"}
          </span>
          <button type="button" className="alert-settings-done" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </>
  );
}
