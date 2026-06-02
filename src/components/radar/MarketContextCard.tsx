"use client";

import type { SymbolContext } from "@/lib/htf-status";
import type { TradingSessionLabel } from "@/lib/trading-session";
import {
  buildMarketSnapshot,
  computeContextScores,
  topCatalystFromFeed,
} from "@/lib/market-context-score";
import { filterNewsForInstrument } from "@/lib/instrument-news";
import type { LiveQuote } from "@/lib/yahoo-live-quote";
import type { SymbolLabel } from "@/lib/strategy-prep";
import { useGeopoliticsFeed } from "@/hooks/use-geopolitics-feed";

type MarketContextCardProps = {
  symbol: SymbolContext;
  session: TradingSessionLabel | "Closed";
  fifteenMMs: number | null;
  candlesPaused: boolean;
  liveQuote?: LiveQuote | null;
};

function scoreClass(level: string): string {
  return `ctx-score-v ctx-score-v--${level.toLowerCase().replace(/\s+/g, "-")}`;
}

export function MarketContextCard({
  symbol,
  session,
  fifteenMMs,
  candlesPaused,
  liveQuote,
}: MarketContextCardProps) {
  const { feed } = useGeopoliticsFeed();
  const instrumentFeed = filterNewsForInstrument(
    feed,
    symbol.label as SymbolLabel,
    10
  );
  const livePrice = liveQuote?.price ?? null;
  const snapshot = buildMarketSnapshot(
    symbol,
    session,
    fifteenMMs,
    candlesPaused,
    topCatalystFromFeed(instrumentFeed, symbol.label as SymbolLabel),
    livePrice
  );
  const scores = computeContextScores(symbol, session, instrumentFeed, livePrice);

  return (
    <section className="ctx-card" aria-label="Instrument context">
      <div className="ctx-snapshot-block">
        <p className="ctx-snapshot-headline" suppressHydrationWarning>
          {snapshot.headline}
        </p>
        <p className="ctx-snapshot-meta" suppressHydrationWarning>
          {snapshot.meta}
        </p>
        {snapshot.catalyst ? (
          <p className="ctx-snapshot-catalyst" suppressHydrationWarning>
            Top catalyst: {snapshot.catalyst}
          </p>
        ) : null}
      </div>
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
