"use client";

import useSWR from "swr";
import Link from "next/link";
import { getNextCandleClose } from "@/lib/candle-timers";
import { getTradingSessionInfo } from "@/lib/trading-session";
import type { MarketContext } from "@/lib/htf-status";
import { useCountdownTick } from "@/hooks/use-countdown-tick";
import { useBiasShiftAlerts } from "@/hooks/use-bias-shift-alerts";
import type { ChartCandlesPayload } from "@/lib/chart-candles-cache";
import { useSeedChartCandles } from "@/hooks/use-seed-chart-candles";
import { BiasShiftToasts } from "@/components/radar/BiasShiftToasts";
import { MarketBoard } from "@/components/radar/MarketBoard";
import { GeopoliticsStrip } from "@/components/radar/GeopoliticsStrip";
import { MarketNewsFeed } from "@/components/radar/MarketNewsFeed";
import { RadarLoader } from "@/components/radar/RadarLoader";

type RadarData = {
  markets: MarketContext | null;
  chartCandles?: Record<string, ChartCandlesPayload>;
};

function EtClock({ now }: { now: number | null }) {
  if (now == null) {
    return <time className="mr-clock" suppressHydrationWarning>—</time>;
  }

  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(now));

  return <time className="mr-clock" suppressHydrationWarning>{label}</time>;
}

export function MarketRadar() {
  const now = useCountdownTick();

  const { data, isLoading } = useSWR<RadarData>("/api/radar", (url: string) =>
    fetch(url).then((r) => r.json()),
    { refreshInterval: 60_000 }
  );

  const tradingSession =
    now != null ? getTradingSessionInfo(new Date(now)) : null;
  const oneH = getNextCandleClose("1H", now != null ? new Date(now) : undefined);
  const fourH = getNextCandleClose("4H", now != null ? new Date(now) : undefined);
  const ctx = data?.markets;

  useSeedChartCandles(data?.chartCandles);
  const { alerts, alertsEnabled, dismissAlert, notifyPermission, enableAlerts, disableAlerts } =
    useBiasShiftAlerts(ctx);

  return (
    <div className="mr-page">
      <BiasShiftToasts alerts={alerts} onDismiss={dismissAlert} />
      <header className="mr-header">
        <div className="mr-header-main">
          <Link href="/" className="mr-back">
            jhptrades.com
          </Link>
          <div className="mr-header-row">
            <h1 className="mr-title">Market Radar</h1>
            {tradingSession ? (
              <div className="mr-session-wrap">
                <span
                  className={
                    tradingSession.isMarketOpen
                      ? "mr-session mr-session--open"
                      : "mr-session mr-session--closed"
                  }
                >
                  {tradingSession.label}
                </span>
                <span className="mr-session-countdown" suppressHydrationWarning>
                  {tradingSession.countdown}
                </span>
              </div>
            ) : (
              <span className="mr-session mr-session--closed">—</span>
            )}
          </div>
        </div>
        <div className="mr-header-actions">
          {alertsEnabled ? (
            <button
              type="button"
              className="mr-notify-on mr-notify-toggle"
              onClick={disableAlerts}
              title="Turn off bias alerts"
            >
              Alerts on
            </button>
          ) : (
            <button
              type="button"
              className="mr-notify-btn"
              onClick={() => void enableAlerts()}
              title="Enable bias shift alerts"
            >
              Enable alerts
            </button>
          )}
          <EtClock now={now} />
        </div>
      </header>

      {isLoading || !ctx || now == null ? (
        <RadarLoader />
      ) : (
        <>
          <GeopoliticsStrip />
          <MarketBoard
            markets={ctx}
            now={now}
            oneHMs={oneH.remainingMs}
            fourHMs={fourH.remainingMs}
            candlesPaused={oneH.paused}
            chartCandles={data?.chartCandles}
          />
          <MarketNewsFeed />
        </>
      )}
    </div>
  );
}
