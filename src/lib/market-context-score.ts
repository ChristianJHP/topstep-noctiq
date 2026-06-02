import { formatCandleCountdown } from "@/lib/candle-timers";
import type { MarketContext, SymbolContext } from "@/lib/htf-status";
import { candleSymbolBias } from "@/lib/htf-status";
import type { TradingSessionLabel } from "@/lib/trading-session";
import { formatPrice } from "@/lib/strategy-prep";
import type { MarketNewsItem } from "@/lib/geopolitics-sources";

export type ClarityLevel = "Low" | "Medium" | "High";
export type VolatilityLevel = "Low" | "Normal" | "Elevated";
export type NewsRiskLevel = "Low" | "Medium" | "High";

export type MarketContextScores = {
  clarity: ClarityLevel;
  volatility: VolatilityLevel;
  newsRisk: NewsRiskLevel;
  sessionLiquidity: TradingSessionLabel | "Closed";
};

function biasLabel(bias: ReturnType<typeof candleSymbolBias>): string {
  if (bias === "bullish") return "Bullish";
  if (bias === "bearish") return "Bearish";
  return "Mixed";
}

function rangeDescriptor(pct: number): string {
  if (pct >= 72) return "near 4H highs";
  if (pct <= 28) return "near 4H lows";
  return "4H range active";
}

export function computeContextScores(
  symbol: SymbolContext,
  markets: MarketContext,
  session: TradingSessionLabel | "Closed",
  feed: MarketNewsItem[]
): MarketContextScores {
  const nqBias = candleSymbolBias(markets.nq);
  const esBias = candleSymbolBias(markets.es);
  const aligned =
    nqBias === esBias && nqBias !== "mixed" && markets.nq.fourHour.bias === markets.es.fourHour.bias;

  let clarity: ClarityLevel = "Medium";
  if (aligned) clarity = "High";
  else if (
    nqBias === "mixed" ||
    esBias === "mixed" ||
    symbol.fourHour.bias !== symbol.oneHour.bias
  ) {
    clarity = "Low";
  }

  const pct = symbol.pctInH4Range;
  let volatility: VolatilityLevel = "Normal";
  if (pct >= 85 || pct <= 15) volatility = "Elevated";
  else if (pct >= 35 && pct <= 65) volatility = "Low";

  const mustKnow = feed.filter((f) => f.label === "MUST KNOW").length;
  const geoHits = feed.filter((f) => f.label === "GEO" || f.label === "HIGH IMPACT").length;
  let newsRisk: NewsRiskLevel = "Low";
  if (mustKnow >= 2 || geoHits >= 3) newsRisk = "High";
  else if (mustKnow >= 1 || geoHits >= 1) newsRisk = "Medium";

  return {
    clarity,
    volatility,
    newsRisk,
    sessionLiquidity: session,
  };
}

export function buildMarketSnapshotLine(
  symbol: SymbolContext,
  session: TradingSessionLabel | "Closed",
  fifteenMMs: number | null,
  candlesPaused: boolean,
  topCatalyst: string | null
): string {
  const bias = biasLabel(candleSymbolBias(symbol));
  const price = formatPrice(symbol.current);
  const range = rangeDescriptor(symbol.pctInH4Range);
  const sessionPart =
    session === "Closed" ? "Futures closed" : `${session} session`;
  const closePart = candlesPaused
    ? "candles paused"
    : fifteenMMs != null
      ? `next 15m close in ${formatCandleCountdown(fifteenMMs)}`
      : null;

  const parts = [
    `${symbol.label}: ${bias} near ${price}`,
    range,
    sessionPart,
    closePart,
    topCatalyst ? `top catalyst: ${topCatalyst}` : null,
  ].filter(Boolean);

  return parts.join(" · ");
}

export function topCatalystFromFeed(feed: MarketNewsItem[]): string | null {
  const top = feed.find((f) => f.label === "MUST KNOW") ?? feed[0];
  if (!top) return null;
  const t = top.text.replace(/^FinancialJuice:\s*/i, "").trim();
  const clause = t.split(/[;,]/)[0]?.trim() ?? t;
  if (clause.length <= 42) return clause;
  return `${clause.slice(0, 41).trim()}…`;
}
