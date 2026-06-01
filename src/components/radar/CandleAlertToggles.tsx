"use client";

import type { CandleInterval } from "@/lib/candle-timers";
import type { CandleAlertSettings } from "@/hooks/use-candle-close-alerts";

const INTERVALS: CandleInterval[] = ["15M", "1H", "4H"];

type CandleAlertTogglesProps = {
  settings: CandleAlertSettings;
  onToggle: (interval: CandleInterval) => void;
};

export function CandleAlertToggles({
  settings,
  onToggle,
}: CandleAlertTogglesProps) {
  return (
    <div className="mr-candle-alerts" role="group" aria-label="Candle close alerts">
      <span className="mr-candle-alerts-k">Close</span>
      {INTERVALS.map((interval) => {
        const on = settings[interval];
        return (
          <button
            key={interval}
            type="button"
            className={`mr-candle-alert${on ? " mr-candle-alert--on" : ""}`}
            aria-pressed={on}
            title={`Alert on ${interval} candle close`}
            onClick={() => void onToggle(interval)}
          >
            {interval}
          </button>
        );
      })}
    </div>
  );
}
