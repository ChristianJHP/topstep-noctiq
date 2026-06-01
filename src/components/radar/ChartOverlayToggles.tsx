"use client";

import {
  CHART_OVERLAY_LABELS,
  type ChartOverlayKey,
  type ChartOverlaySettings,
} from "@/lib/chart-overlay-types";

type ChartOverlayTogglesProps = {
  settings: ChartOverlaySettings;
  onToggle: (key: ChartOverlayKey) => void;
};

const OVERLAY_ORDER: ChartOverlayKey[] = [
  "draw",
  "fvg",
  "rejection",
  "session",
  "cisd",
  "levels",
];

export function ChartOverlayToggles({
  settings,
  onToggle,
}: ChartOverlayTogglesProps) {
  return (
    <div
      className="chart-overlay-toggles"
      role="group"
      aria-label="Chart overlays"
    >
      {OVERLAY_ORDER.map((key) => {
        const on = settings[key];
        const { short, label } = CHART_OVERLAY_LABELS[key];
        return (
          <button
            key={key}
            type="button"
            className={`chart-overlay-toggle chart-overlay-toggle--${key}${on ? " chart-overlay-toggle--on" : ""}`}
            aria-pressed={on}
            title={label}
            onClick={() => onToggle(key)}
          >
            {short}
          </button>
        );
      })}
    </div>
  );
}
