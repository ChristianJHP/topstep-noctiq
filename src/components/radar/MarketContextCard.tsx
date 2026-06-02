"use client";

import useSWR from "swr";
import type { MarketContext } from "@/lib/htf-status";
import type { SymbolContext } from "@/lib/htf-status";
import type { SymbolPrep } from "@/lib/strategy-prep";
import type { TradingSessionLabel } from "@/lib/trading-session";
import {
  buildMarketSnapshotLine,
  computeContextScores,
  topCatalystFromFeed,
} from "@/lib/market-context-score";
import type { MarketNewsItem } from "@/lib/geopolitics-sources";

type GeoPayload = {
  feed?: MarketNewsItem[];
};

type MarketContextCardProps = {
  symbol: SymbolContext;
  markets: MarketContext;
  prep: SymbolPrep;
  session: TradingSessionLabel | "Closed";
  fifteenMMs: number | null;
  candlesPaused: boolean;
};

function scoreClass(level: string): string {
  return `ctx-score-v ctx-score-v--${level.toLowerCase().replace(/\s+/g, "-")}`;
}

export function MarketContextCard({
  symbol,
  markets,
  session,
  fifteenMMs,
  candlesPaused,
}: MarketContextCardProps) {
  const { data } = useSWR<GeoPayload>(
    "/api/bias/geopolitics",
    (url: string) => fetch(url).then((r) => r.json()),
    {
      refreshInterval: 60_000,
      revalidateOnFocus: true,
      dedupingInterval: 30_000,
    }
  );

  const feed = data?.feed ?? [];
  const catalyst = topCatalystFromFeed(feed);
  const snapshot = buildMarketSnapshotLine(
    symbol,
    session,
    fifteenMMs,
    candlesPaused,
    catalyst
  );
  const scores = computeContextScores(symbol, markets, session, feed);

  return (
    <section className="ctx-card" aria-label="Market context">
      <p className="ctx-snapshot" suppressHydrationWarning>
        {snapshot}
      </p>
      <div className="ctx-scores">
        <div className="ctx-score">
          <span className="ctx-score-k">Context clarity</span>
          <span className={scoreClass(scores.clarity)}>{scores.clarity}</span>
        </div>
        <div className="ctx-score">
          <span className="ctx-score-k">Volatility</span>
          <span className={scoreClass(scores.volatility)}>{scores.volatility}</span>
        </div>
        <div className="ctx-score">
          <span className="ctx-score-k">News risk</span>
          <span className={scoreClass(scores.newsRisk)}>{scores.newsRisk}</span>
        </div>
        <div className="ctx-score">
          <span className="ctx-score-k">Session liquidity</span>
          <span className="ctx-score-v">{scores.sessionLiquidity}</span>
        </div>
      </div>
    </section>
  );
}
