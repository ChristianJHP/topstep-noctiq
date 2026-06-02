"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Connecting to CME futures",
  "Loading NQ · ES · Gold",
  "Syncing candle history",
  "Scanning FVG structure",
  "Pulling geo context",
  "Almost ready",
];

const CANDLE_HEIGHTS = [42, 58, 36, 72, 48, 64, 38, 55, 70, 44, 62, 50, 68, 40, 56];

export function RadarLoader() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStep((s) => (s + 1) % STEPS.length);
    }, 2400);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="mr-loader" aria-busy="true" aria-label="Loading market bias">
      <div className="mr-loader-geo" aria-hidden>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="mr-loader-geo-row">
            <span className="mr-loader-shimmer mr-loader-shimmer--k" />
            <span className="mr-loader-shimmer mr-loader-shimmer--line" />
          </div>
        ))}
      </div>

      <div className="mr-board mr-loader-board">
        <div className="mr-loader-progress" aria-hidden>
          <div className="mr-loader-progress-bar" />
        </div>

        <div className="mr-loader-strip" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="mr-loader-strip-cell"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <span className="mr-loader-shimmer mr-loader-shimmer--sm" />
              <span className="mr-loader-shimmer mr-loader-shimmer--md" />
            </div>
          ))}
        </div>

        <div className="mr-loader-panel" aria-hidden>
          <div className="mr-loader-tabs">
            {["NQ", "ES", "Gold"].map((tab, i) => (
              <span
                key={tab}
                className={`mr-loader-tab${i === 0 ? " mr-loader-tab--active" : ""}`}
              >
                {tab}
              </span>
            ))}
          </div>

          <div className="mr-loader-chart-wrap">
            <div className="mr-loader-chart-top">
              <span className="mr-loader-shimmer mr-loader-shimmer--dots" />
              <span className="mr-loader-shimmer mr-loader-shimmer--price" />
            </div>
            <div className="mr-loader-tf">
              {["5m", "15m", "1H", "4H"].map((tf, i) => (
                <span
                  key={tf}
                  className={`mr-loader-tf-pill${i === 2 ? " mr-loader-tf-pill--active" : ""}`}
                >
                  {tf}
                </span>
              ))}
            </div>
            <div className="mr-loader-chart">
              <div className="mr-loader-candles">
                {CANDLE_HEIGHTS.map((h, i) => (
                  <span
                    key={i}
                    className="mr-loader-candle"
                    style={{
                      height: `${h}%`,
                      animationDelay: `${i * 0.05}s`,
                    }}
                  />
                ))}
              </div>
              <div className="mr-loader-scan" />
              <div className="mr-loader-chart-axis">
                {Array.from({ length: 4 }).map((_, i) => (
                  <span key={i} className="mr-loader-shimmer mr-loader-shimmer--axis" />
                ))}
              </div>
            </div>
            <div className="mr-loader-levels">
              <span className="mr-loader-shimmer mr-loader-shimmer--k" />
              <span className="mr-loader-shimmer mr-loader-shimmer--line" />
            </div>
          </div>
        </div>

        <p className="mr-loader-status">
          <span className="mr-loader-status-pip" aria-hidden />
          <span key={step} className="mr-loader-status-text">
            {STEPS[step]}
          </span>
        </p>
      </div>
    </div>
  );
}
