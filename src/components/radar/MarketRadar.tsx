"use client";

import useSWR from "swr";
import Link from "next/link";
import { getNextCandleClose } from "@/lib/candle-timers";
import { getTradingSessionInfo } from "@/lib/trading-session";
import type { RadarPayload } from "@/lib/radar-payload";
import { useCountdownTick } from "@/hooks/use-countdown-tick";
import { useBiasShiftAlerts } from "@/hooks/use-bias-shift-alerts";
import { useCandleCloseAlerts } from "@/hooks/use-candle-close-alerts";
import { useSeedChartCandles } from "@/hooks/use-seed-chart-candles";
import { BiasShiftToasts } from "@/components/radar/BiasShiftToasts";
import { CandleAlertToggles } from "@/components/radar/CandleAlertToggles";
import { CandleCloseToasts } from "@/components/radar/CandleCloseToasts";
import { RedFolderMoveToasts } from "@/components/radar/RedFolderMoveToasts";
import { MarketBoard } from "@/components/radar/MarketBoard";
import { useRedFolderMoveAlerts } from "@/hooks/use-red-folder-move-alerts";
import type { EconomicEvent } from "@/lib/events";
import { GeopoliticsStrip } from "@/components/radar/GeopoliticsStrip";
import { MarketNewsFeed } from "@/components/radar/MarketNewsFeed";
import { RadarLoader } from "@/components/radar/RadarLoader";

type RadarData = Pick<
  RadarPayload,
  "markets" | "chartCandles" | "redFolderWeek"
>;

type MarketRadarProps = {
  initialData?: RadarPayload | null;
};

function EtClock({ now }: { now: number }) {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(now));

  return <time className="mr-clock" suppressHydrationWarning>{label}</time>;
}

export function MarketRadar({ initialData }: MarketRadarProps) {
  const now = useCountdownTick();

  const { data, isLoading } = useSWR<RadarData>(
    "/api/radar",
    (url: string) => fetch(url).then((r) => r.json()),
    {
      fallbackData: initialData ?? undefined,
      revalidateOnMount: !initialData?.markets,
      refreshInterval: 60_000,
    }
  );

  const tradingSession = getTradingSessionInfo(new Date(now));
  const fifteenM = getNextCandleClose("15M", new Date(now));
  const oneH = getNextCandleClose("1H", new Date(now));
  const fourH = getNextCandleClose("4H", new Date(now));
  const ctx = data?.markets;

  useSeedChartCandles(data?.chartCandles);
  const { alerts, alertsEnabled, dismissAlert, enableAlerts, disableAlerts } =
    useBiasShiftAlerts(ctx);
  const {
    settings: candleAlertSettings,
    toggle: toggleCandleAlert,
    alerts: candleCloseAlerts,
    dismissAlert: dismissCandleAlert,
  } = useCandleCloseAlerts(now);

  const redFolderEvents: EconomicEvent[] =
    data?.redFolderWeek ?? initialData?.redFolderWeek ?? [];
  const { alerts: redFolderMoveAlerts, dismissAlert: dismissRedFolderMove } =
    useRedFolderMoveAlerts(redFolderEvents);

  const showLoader = !ctx && isLoading;

  return (
    <div className="mr-page">
      <BiasShiftToasts alerts={alerts} onDismiss={dismissAlert} />
      <CandleCloseToasts
        alerts={candleCloseAlerts}
        onDismiss={dismissCandleAlert}
      />
      <RedFolderMoveToasts
        alerts={redFolderMoveAlerts}
        onDismiss={dismissRedFolderMove}
      />
      <header className="mr-header">
        <div className="mr-header-main">
          <Link href="/" className="mr-back">
            jhptrades.com
          </Link>
          <div className="mr-header-row">
            <h1 className="mr-title">Market Bias</h1>
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
          </div>
        </div>
        <div className="mr-header-actions">
          <div className="mr-header-notify-row">
            {alertsEnabled ? (
              <button
                type="button"
                className="mr-notify-on mr-notify-toggle"
                onClick={disableAlerts}
                title="Turn off bias alerts"
              >
                Bias on
              </button>
            ) : (
              <button
                type="button"
                className="mr-notify-btn"
                onClick={() => void enableAlerts()}
                title="Enable bias shift alerts"
              >
                Bias alerts
              </button>
            )}
            <CandleAlertToggles
              settings={candleAlertSettings}
              onToggle={toggleCandleAlert}
            />
          </div>
          <EtClock now={now} />
        </div>
      </header>

      {showLoader ? (
        <RadarLoader />
      ) : ctx ? (
        <>
          <GeopoliticsStrip />
          <MarketBoard
            markets={ctx}
            now={now}
            fifteenMMs={fifteenM.remainingMs}
            oneHMs={oneH.remainingMs}
            fourHMs={fourH.remainingMs}
            candlesPaused={oneH.paused}
            chartCandles={data?.chartCandles}
          />
          <MarketNewsFeed />
        </>
      ) : (
        <p className="geo-strip-muted" style={{ padding: "1rem" }}>
          Market data unavailable — retrying…
        </p>
      )}
    </div>
  );
}
