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

export type MarketSnapshot = {
  headline: string;
  meta: string;
  catalyst: string | null;
};

function contextBiasLabel(bias: ReturnType<typeof candleSymbolBias>): string {
  if (bias === "bullish") return "Bullish context";
  if (bias === "bearish") return "Bearish context";
  return "Mixed context";
}

function rangeDescriptor(pct: number): string {
  if (pct >= 72) return "near 4H highs";
  if (pct <= 28) return "near 4H lows";
  return "4H range active";
}

function pctInH4Range(symbol: SymbolContext, price: number): number {
  if (symbol.h4High <= symbol.h4Low) return 50;
  return Math.round(
    ((price - symbol.h4Low) / (symbol.h4High - symbol.h4Low)) * 100
  );
}

function nearCleanLevel(symbol: SymbolContext, price: number): boolean {
  const threshold = symbol.label === "GC" ? 6 : symbol.label === "ES" ? 4 : 20;
  const dists = [
    symbol.h4High - price,
    price - symbol.h4Low,
    symbol.h1High - price,
    price - symbol.h1Low,
  ];
  if (symbol.analysis.cisd) {
    dists.push(Math.abs(price - symbol.analysis.cisd.price));
  }
  if (symbol.analysis.swingHigh) {
    dists.push(Math.abs(price - symbol.analysis.swingHigh));
  }
  if (symbol.analysis.swingLow) {
    dists.push(Math.abs(price - symbol.analysis.swingLow));
  }
  return dists.some((d) => d <= threshold);
}

/** Mechanical clarity — not discretionary. */
export function computeContextClarity(
  symbol: SymbolContext,
  livePrice?: number | null
): ClarityLevel {
  const price = livePrice ?? symbol.current;
  const h4 = symbol.fourHour.bias;
  const h1 = symbol.oneHour.bias;
  const pct = pctInH4Range(symbol, price);
  const mixed = candleSymbolBias(symbol) === "mixed";
  const inChop = pct >= 30 && pct <= 70;
  const tfConflict =
    h4 !== h1 && h4 !== "neutral" && h1 !== "neutral";
  const aligned = h4 === h1 && h4 !== "neutral" && !mixed;

  if (inChop || (h4 === "neutral" && h1 === "neutral")) return "Low";
  if (tfConflict || mixed) return "Medium";
  if (aligned && nearCleanLevel(symbol, price)) return "High";
  return "Medium";
}

export function computeContextScores(
  symbol: SymbolContext,
  session: TradingSessionLabel | "Closed",
  feed: MarketNewsItem[],
  livePrice?: number | null
): MarketContextScores {
  let clarity = computeContextClarity(symbol, livePrice);

  const pct = pctInH4Range(symbol, livePrice ?? symbol.current);
  let volatility: VolatilityLevel = "Normal";
  if (pct >= 85 || pct <= 15) volatility = "Elevated";
  else if (pct >= 35 && pct <= 65) volatility = "Low";

  const mustKnow = feed.filter((f) => f.label === "MUST KNOW").length;
  const geoHits = feed.filter((f) => f.label === "GEO" || f.label === "HIGH IMPACT").length;
  let newsRisk: NewsRiskLevel = "Low";
  if (mustKnow >= 2 || geoHits >= 3) newsRisk = "High";
  else if (mustKnow >= 1 || geoHits >= 1) newsRisk = "Medium";

  if (newsRisk === "High" && clarity === "High") clarity = "Medium";
  if (newsRisk === "Medium" && clarity === "High") clarity = "Medium";
  if (session === "Asia" && clarity === "High") clarity = "Medium";

  return {
    clarity,
    volatility,
    newsRisk,
    sessionLiquidity: session,
  };
}

export function buildMarketSnapshot(
  symbol: SymbolContext,
  session: TradingSessionLabel | "Closed",
  fifteenMMs: number | null,
  candlesPaused: boolean,
  topCatalyst: string | null,
  livePrice?: number | null
): MarketSnapshot {
  const bias = contextBiasLabel(candleSymbolBias(symbol));
  const price = formatPrice(livePrice ?? symbol.current);
  const range = rangeDescriptor(
    pctInH4Range(symbol, livePrice ?? symbol.current)
  );
  const sessionPart =
    session === "Closed" ? "Futures closed" : `${session} session`;
  const closePart = candlesPaused
    ? "candles paused"
    : fifteenMMs != null
      ? `15m close in ${formatCandleCountdown(fifteenMMs)}`
      : null;

  return {
    headline: `${symbol.label} · ${bias} near ${price}`,
    meta: [range, sessionPart, closePart].filter(Boolean).join(" · "),
    catalyst: topCatalyst,
  };
}

export function topCatalystFromFeed(feed: MarketNewsItem[]): string | null {
  const top = feed.find((f) => f.label === "MUST KNOW") ?? feed[0];
  if (!top) return null;
  const t = top.text.replace(/^FinancialJuice:\s*/i, "").trim();
  const clause = t.split(/[;,]/)[0]?.trim() ?? t;
  if (clause.length <= 52) return clause;
  return `${clause.slice(0, 51).trim()}…`;
}
