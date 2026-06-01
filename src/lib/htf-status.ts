import { MARKET_TICKERS, type Candle } from "@/lib/chart-data";
import {
  getCachedChartCandles,
  type ChartCandlesPayload,
} from "@/lib/chart-candles-cache";
import { chartCacheKey } from "@/lib/chart-candles-store";
import { aggregate1h, aggregate4h, type OhlcBar } from "@/lib/ohlc-aggregate";
import { analyzeSymbolMarket, type SymbolMarketAnalysis } from "@/lib/market-analysis";

export type CandleBias = "bullish" | "bearish" | "neutral";

export interface IntervalBias {
  bias: CandleBias;
  emoji: string;
  label: string;
  colorLabel: string;
}

export interface SymbolDistances {
  toH4High: number;
  toH4Low: number;
  toH1High: number;
  toH1Low: number;
}

export interface SymbolContext {
  label: string;
  ticker: string;
  current: number;
  fourHour: IntervalBias;
  oneHour: IntervalBias;
  expansion: string;
  h4High: number;
  h4Low: number;
  h1High: number;
  h1Low: number;
  priorH4High: number;
  priorH4Low: number;
  distances: SymbolDistances;
  pctInH4Range: number;
  pctInH1Range: number;
  analysis: SymbolMarketAnalysis;
}

export interface RelativeStrength {
  stronger: "ES" | "NQ" | "neutral";
  headline: string;
  esPtsFromH4High: number;
  nqPtsFromH4High: number;
}

export interface SmtAlert {
  type: "bearish" | "bullish";
  message: string;
}

export interface MarketContext {
  nq: SymbolContext;
  es: SymbolContext;
  gold: SymbolContext;
  relativeStrength: RelativeStrength;
  smt: SmtAlert | null;
}

export type MarketRadarStatus = MarketContext;

function toBias(close: number, open: number): IntervalBias {
  if (close > open) {
    return { bias: "bullish", emoji: "🟢", label: "Bull", colorLabel: "Green" };
  }
  if (close < open) {
    return { bias: "bearish", emoji: "🔴", label: "Bear", colorLabel: "Red" };
  }
  return { bias: "neutral", emoji: "🟡", label: "Flat", colorLabel: "Flat" };
}

function expansionStatus(
  lastPrice: number,
  prior4h: OhlcBar | undefined
): string {
  if (!prior4h) return "—";
  if (lastPrice > prior4h.high) return "Above prior 4H high";
  if (lastPrice < prior4h.low) return "Below prior 4H low";
  return "Inside 4H range";
}

function pctTowardHigh(price: number, low: number, high: number): number {
  if (high <= low) return 50;
  return Math.round(((price - low) / (high - low)) * 100);
}

function roundPts(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildSymbolContext(
  label: string,
  ticker: string,
  candles: Candle[],
  bars4h: OhlcBar[],
  bars1h: OhlcBar[]
): SymbolContext {
  const current = candles[candles.length - 1]?.close ?? 0;
  const current4h = bars4h[bars4h.length - 1];
  const current1h = bars1h[bars1h.length - 1];
  const prior4h = bars4h[bars4h.length - 2];

  const h4High = current4h?.high ?? current;
  const h4Low = current4h?.low ?? current;
  const h1High = current1h?.high ?? current;
  const h1Low = current1h?.low ?? current;
  const priorH4High = prior4h?.high ?? h4High;
  const priorH4Low = prior4h?.low ?? h4Low;

  const analysis = analyzeSymbolMarket(
    candles,
    h4High,
    h4Low,
    priorH4High,
    priorH4Low,
    current
  );

  return {
    label,
    ticker,
    current: roundPts(current),
    fourHour: current4h
      ? toBias(current4h.close, current4h.open)
      : { bias: "neutral", emoji: "🟡", label: "—", colorLabel: "—" },
    oneHour: current1h
      ? toBias(current1h.close, current1h.open)
      : { bias: "neutral", emoji: "🟡", label: "—", colorLabel: "—" },
    expansion: expansionStatus(current, prior4h),
    h4High: roundPts(h4High),
    h4Low: roundPts(h4Low),
    h1High: roundPts(h1High),
    h1Low: roundPts(h1Low),
    priorH4High: roundPts(priorH4High),
    priorH4Low: roundPts(priorH4Low),
    distances: {
      toH4High: roundPts(h4High - current),
      toH4Low: roundPts(current - h4Low),
      toH1High: roundPts(h1High - current),
      toH1Low: roundPts(current - h1Low),
    },
    pctInH4Range: pctTowardHigh(current, h4Low, h4High),
    pctInH1Range: pctTowardHigh(current, h1Low, h1High),
    analysis,
  };
}

function detectIntervalSmt(
  nqBars: OhlcBar[],
  esBars: OhlcBar[],
  interval: "4H" | "1H"
): SmtAlert | null {
  if (nqBars.length < 2 || esBars.length < 2) return null;

  const nqPrior = nqBars[nqBars.length - 2];
  const esPrior = esBars[esBars.length - 2];
  const nqCur = nqBars[nqBars.length - 1];
  const esCur = esBars[esBars.length - 1];

  const nqNewHigh = nqCur.high > nqPrior.high;
  const esNewHigh = esCur.high > esPrior.high;
  const nqNewLow = nqCur.low < nqPrior.low;
  const esNewLow = esCur.low < esPrior.low;

  if (nqNewHigh && !esNewHigh) {
    return {
      type: "bearish",
      message: `NQ swept ${interval} high, ES failed`,
    };
  }
  if (esNewHigh && !nqNewHigh) {
    return {
      type: "bearish",
      message: `ES swept ${interval} high, NQ failed`,
    };
  }
  if (nqNewLow && !esNewLow) {
    return {
      type: "bullish",
      message: `NQ swept ${interval} low, ES failed`,
    };
  }
  if (esNewLow && !nqNewLow) {
    return {
      type: "bullish",
      message: `ES swept ${interval} low, NQ failed`,
    };
  }

  return null;
}

function detectSmt(
  nq4h: OhlcBar[],
  es4h: OhlcBar[],
  nq1h: OhlcBar[],
  es1h: OhlcBar[]
): SmtAlert | null {
  return (
    detectIntervalSmt(nq4h, es4h, "4H") ??
    detectIntervalSmt(nq1h, es1h, "1H")
  );
}

function computeRelativeStrength(
  nq: SymbolContext,
  es: SymbolContext
): RelativeStrength {
  const esPts = es.distances.toH4High;
  const nqPts = nq.distances.toH4High;
  const gap = nqPts - esPts;

  let stronger: RelativeStrength["stronger"] = "neutral";
  let headline = "Balanced";

  if (gap > 15) {
    stronger = "ES";
    headline = "ES leading";
  } else if (gap < -15) {
    stronger = "NQ";
    headline = "NQ leading";
  }

  return {
    stronger,
    headline,
    esPtsFromH4High: esPts,
    nqPtsFromH4High: nqPts,
  };
}

async function computeSymbol(
  label: string,
  ticker: string,
  prefetched?: Candle[]
): Promise<{ context: SymbolContext; bars1h: OhlcBar[]; bars4h: OhlcBar[] }> {
  const candles =
    prefetched ??
    (await getCachedChartCandles(ticker, "60m", "3mo")).candles;
  const bars4h = aggregate4h(candles);
  const bars1h = aggregate1h(candles);

  return {
    context: buildSymbolContext(label, ticker, candles, bars4h, bars1h),
    bars1h,
    bars4h,
  };
}

function candlesFromPrefetch(
  chartCandles: Record<string, ChartCandlesPayload>,
  ticker: string
): Candle[] | undefined {
  const key = chartCacheKey(ticker, "60m", "3mo");
  const payload = chartCandles[key];
  return payload?.candles?.length ? payload.candles : undefined;
}

/** Build market context from chart bundle already loaded for /api/radar. */
export async function computeMarketContextFromCharts(
  chartCandles: Record<string, ChartCandlesPayload>
): Promise<MarketContext> {
  const [nqResult, esResult, goldResult] = await Promise.all([
    computeSymbol(
      "NQ",
      MARKET_TICKERS.NQ,
      candlesFromPrefetch(chartCandles, MARKET_TICKERS.NQ)
    ),
    computeSymbol(
      "ES",
      MARKET_TICKERS.ES,
      candlesFromPrefetch(chartCandles, MARKET_TICKERS.ES)
    ),
    computeSymbol(
      "GC",
      MARKET_TICKERS.GC,
      candlesFromPrefetch(chartCandles, MARKET_TICKERS.GC)
    ),
  ]);

  const nq = nqResult.context;
  const es = esResult.context;

  return {
    nq,
    es,
    gold: goldResult.context,
    relativeStrength: computeRelativeStrength(nq, es),
    smt: detectSmt(
      nqResult.bars4h,
      esResult.bars4h,
      nqResult.bars1h,
      esResult.bars1h
    ),
  };
}

export async function computeMarketContext(): Promise<MarketContext> {
  const [nqResult, esResult, goldResult] = await Promise.all([
    computeSymbol("NQ", MARKET_TICKERS.NQ),
    computeSymbol("ES", MARKET_TICKERS.ES),
    computeSymbol("GC", MARKET_TICKERS.GC),
  ]);

  const nq = nqResult.context;
  const es = esResult.context;

  return {
    nq,
    es,
    gold: goldResult.context,
    relativeStrength: computeRelativeStrength(nq, es),
    smt: detectSmt(
      nqResult.bars4h,
      esResult.bars4h,
      nqResult.bars1h,
      esResult.bars1h
    ),
  };
}

export function candleSymbolBias(
  symbol: SymbolContext
): "bullish" | "bearish" | "mixed" {
  const h4 = symbol.fourHour.bias;
  const h1 = symbol.oneHour.bias;
  if (h4 === h1 && h4 !== "neutral") return h4;
  if (h4 !== "neutral" && h1 === "neutral") return h4;
  if (h1 !== "neutral" && h4 === "neutral") return h1;
  return "mixed";
}

export async function computeMarketRadarStatus(): Promise<MarketContext> {
  return computeMarketContext();
}
