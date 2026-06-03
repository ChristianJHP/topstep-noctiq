"use client";

import {
  CHART_OVERLAY_LABELS,
  type ChartOverlayKey,
  type ChartOverlaySettings,
} from "@/lib/chart-overlay-types";
import type { OverlayHint } from "@/lib/instrument-trade-map";

type ChartOverlayTogglesProps = {
  settings: ChartOverlaySettings;
  onToggle: (key: ChartOverlayKey) => void;
  hints?: Partial<Record<ChartOverlayKey, OverlayHint>>;
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
  hints,
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
        const hint = hints?.[key]?.label;
        return (
          <button
            key={key}
            type="button"
            className={`chart-overlay-toggle chart-overlay-toggle--${key}${on ? " chart-overlay-toggle--on" : ""}`}
            aria-pressed={on}
            title={label}
            onClick={() => onToggle(key)}
          >
            <span className="chart-overlay-toggle-k">{short}</span>
            {hint ? (
              <span className="chart-overlay-toggle-v">{hint}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
