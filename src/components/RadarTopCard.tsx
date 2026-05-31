"use client";

import useSWR from "swr";
import {
  formatCountdownHuman,
  getNextCandleClose,
} from "@/lib/candle-timers";
import type { EconomicEvent } from "@/lib/events";
import type { MarketContext, SymbolContext } from "@/lib/htf-status";
import { useCountdownTick } from "@/hooks/use-countdown-tick";
import { MiniSymbolChart } from "@/components/MiniSymbolChart";

type RadarData = {
  markets: MarketContext | null;
  nextHighImpact: EconomicEvent | null;
  redFolderWeek: EconomicEvent[];
};

function SymbolPanel({ s }: { s: SymbolContext }) {
  return (
    <article className="symbol-panel">
      <div className="symbol-panel-head">
        <div className="symbol-panel-title">
          <span className="symbol-panel-label">{s.label}</span>
          <span className="chart-legend-inline" aria-hidden>
            <span className="legend-chip legend-chip--h4">4H</span>
            <span className="legend-chip legend-chip--prior">Prior</span>
          </span>
        </div>
        <span className="symbol-panel-price">{s.current.toLocaleString()}</span>
      </div>

      <div className="mini-chart-block">
        <MiniSymbolChart
          ticker={s.ticker}
          levels={{
            h4High: s.h4High,
            h4Low: s.h4Low,
            priorH4High: s.priorH4High,
            priorH4Low: s.priorH4Low,
          }}
        />
        <div className="level-keys">
          <span>
            <span className="level-dot level-dot--h4" />
            H {s.h4High.toLocaleString()}
          </span>
          <span>
            <span className="level-dot level-dot--h4" />
            L {s.h4Low.toLocaleString()}
          </span>
          <span>
            <span className="level-dot level-dot--prior" />
            Pr H {s.priorH4High.toLocaleString()}
          </span>
          <span>
            <span className="level-dot level-dot--prior" />
            Pr L {s.priorH4Low.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="symbol-panel-foot">
        <span className={`bias-tag bias-tag--${s.fourHour.bias}`}>
          4H {s.fourHour.colorLabel}
        </span>
        <span className="symbol-panel-dot">·</span>
        <span className={`bias-tag bias-tag--${s.oneHour.bias}`}>
          1H {s.oneHour.colorLabel}
        </span>
        <span className="symbol-panel-dot">·</span>
        <span className="symbol-panel-foot-distance">
          {s.distances.toH4High}pt to high
        </span>
      </div>
    </article>
  );
}

export function RadarTopCard() {
  const now = useCountdownTick();
  const { data, isLoading } = useSWR<RadarData>("/api/radar", (url: string) =>
    fetch(url).then((r) => r.json()),
    { refreshInterval: 60_000 }
  );

  const fourH = getNextCandleClose("4H", new Date(now));
  const oneH = getNextCandleClose("1H", new Date(now));
  const ctx = data?.markets;
  const nextNews =
    data?.redFolderWeek?.[0] ?? data?.nextHighImpact ?? null;

  return (
    <div className="radar-card">
      <header className="radar-header">
        <h1>Daily Bias</h1>
        <span className="live-dot">Live</span>
      </header>

      {isLoading || !ctx ? (
        <p className="radar-loading">Loading…</p>
      ) : (
        <>
          <div className="markets-grid">
            <SymbolPanel s={ctx.nq} />
            <SymbolPanel s={ctx.es} />
          </div>

          {(ctx.relativeStrength.stronger !== "neutral" || ctx.smt) && (
            <div className="radar-alerts">
              {ctx.relativeStrength.stronger !== "neutral" && (
                <p>
                  {ctx.relativeStrength.headline} — ES{" "}
                  {ctx.relativeStrength.esPtsFromH4High}pt · NQ{" "}
                  {ctx.relativeStrength.nqPtsFromH4High}pt to 4H high
                </p>
              )}
              {ctx.smt && (
                <p
                  className={
                    ctx.smt.type === "bearish"
                      ? "radar-alert-smt--bear"
                      : "radar-alert-smt--bull"
                  }
                >
                  {ctx.smt.message}
                </p>
              )}
            </div>
          )}
        </>
      )}

      <footer className="radar-footer">
        <div className="radar-footer-cell radar-footer-news">
          <span className="radar-footer-label">News</span>
          {nextNews ? (
            <>
              <span className="radar-footer-news-title">{nextNews.title}</span>
              <span className="radar-footer-news-time">
                {formatCountdownHuman(
                  new Date(nextNews.scheduledAt).getTime() - now
                )}
              </span>
            </>
          ) : (
            <span className="radar-footer-muted">None scheduled</span>
          )}
        </div>
        <div className="radar-footer-timers">
          <div className="radar-footer-cell">
            <span className="radar-footer-label">1H close</span>
            <span className="radar-footer-value">
              {formatCountdownHuman(oneH.remainingMs)}
            </span>
          </div>
          <div className="radar-footer-cell">
            <span className="radar-footer-label">4H close</span>
            <span className="radar-footer-value">
              {formatCountdownHuman(fourH.remainingMs)}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
