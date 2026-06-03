"use client";

import { useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import type { RadarTab } from "@/components/radar/MarketBoard";
import {
  detectSignificantMove,
  PRICE_REACTION_COOLDOWN_MS,
  prunePriceHistory,
  type PriceSample,
} from "@/lib/price-move-threshold";
import { formatLivePriceReaction } from "@/lib/live-reaction";
import type { LiveQuote } from "@/lib/yahoo-live-quote";
import type { InstrumentSummaryPayload } from "@/hooks/use-instrument-bias-summary";
import { CHART_TF_CONFIG } from "@/lib/chart-timeframe";
import { chartCandlesSwrKey } from "@/lib/chart-candles-cache";

const summaryFetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("summary refresh failed");
    return r.json() as Promise<InstrumentSummaryPayload>;
  });

/** On volatile moves: flash reaction, refresh bias, news, and chart candles. */
export function usePriceReactions(
  symbol: RadarTab,
  ticker: string,
  liveQuote: LiveQuote | null,
  active: boolean
) {
  const { mutate } = useSWRConfig();
  const [liveReaction, setLiveReaction] = useState<string | null>(null);
  const historyRef = useRef<PriceSample[]>([]);
  const lastReactionAtRef = useRef(0);

  useEffect(() => {
    if (!active || !liveQuote?.price || liveQuote.price <= 0) return;

    const now = Date.now();
    historyRef.current = prunePriceHistory(
      [...historyRef.current, { t: now, price: liveQuote.price }],
      now
    );

    const move = detectSignificantMove(symbol, historyRef.current, now);
    if (!move) return;
    if (now - lastReactionAtRef.current < PRICE_REACTION_COOLDOWN_MS) return;

    lastReactionAtRef.current = now;
    const reaction = formatLivePriceReaction(symbol, move);
    setLiveReaction(reaction);

    const summaryKey = `/api/bias/instrument-summary?symbol=${symbol}`;
    const reactionParam = encodeURIComponent(reaction);

    void mutate(
      summaryKey,
      summaryFetcher(
        `${summaryKey}&fresh=1&reaction=${reactionParam}`
      ),
      { revalidate: false }
    ).finally(() => {
      window.setTimeout(() => setLiveReaction(null), 12_000);
    });

    void mutate(
      "/api/bias/geopolitics",
      fetch("/api/bias/geopolitics?fresh=1").then((r) => r.json()),
      { revalidate: false }
    );

    for (const tf of ["1H", "5m"] as const) {
      const cfg = CHART_TF_CONFIG[tf];
      const chartKey = chartCandlesSwrKey(ticker, cfg.interval, cfg.range);
      void mutate(
        chartKey,
        fetch(`${chartKey}&fresh=1`).then((r) => r.json()),
        { revalidate: false }
      );
    }
  }, [active, liveQuote?.fetchedAt, liveQuote?.price, mutate, symbol, ticker]);

  return { liveReaction };
}
