import { fetchCandles, MARKET_TICKERS, type Candle } from "@/lib/chart-data";
import { aggregate1h, aggregate4h, type OhlcBar } from "@/lib/ohlc-aggregate";

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
  priorH4High: number;
  priorH4Low: number;
  distances: SymbolDistances;
  pctToH4High: number;
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
    priorH4High: roundPts(prior4h?.high ?? h4High),
    priorH4Low: roundPts(prior4h?.low ?? h4Low),
    distances: {
      toH4High: roundPts(h4High - current),
      toH4Low: roundPts(current - h4Low),
    },
    pctToH4High: pctTowardHigh(current, h4Low, h4High),
  };
}

function detectSmt(
  nq: SymbolContext,
  es: SymbolContext,
  nq1h: OhlcBar[],
  es1h: OhlcBar[]
): SmtAlert | null {
  if (nq1h.length < 2 || es1h.length < 2) return null;

  const nqPrior = nq1h[nq1h.length - 2];
  const esPrior = es1h[es1h.length - 2];
  const nqCur = nq1h[nq1h.length - 1];
  const esCur = es1h[es1h.length - 1];

  const nqNewHigh = nqCur.high > nqPrior.high;
  const esNewHigh = esCur.high > esPrior.high;
  const nqNewLow = nqCur.low < nqPrior.low;
  const esNewLow = esCur.low < esPrior.low;

  if (esNewHigh && !nqNewHigh) {
    return {
      type: "bearish",
      message: "ES new 1H high · NQ failed — bearish SMT",
    };
  }
  if (nqNewHigh && !esNewHigh) {
    return {
      type: "bearish",
      message: "NQ new 1H high · ES failed — bearish SMT",
    };
  }
  if (esNewLow && !nqNewLow) {
    return {
      type: "bullish",
      message: "ES new 1H low · NQ failed — bullish SMT",
    };
  }
  if (nqNewLow && !esNewLow) {
    return {
      type: "bullish",
      message: "NQ new 1H low · ES failed — bullish SMT",
    };
  }

  return null;
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
  ticker: string
): Promise<{ context: SymbolContext; bars1h: OhlcBar[] }> {
  const candles = await fetchCandles(ticker);
  const bars4h = aggregate4h(candles);
  const bars1h = aggregate1h(candles);

  return {
    context: buildSymbolContext(label, ticker, candles, bars4h, bars1h),
    bars1h,
  };
}

export async function computeMarketContext(): Promise<MarketContext> {
  const [nqResult, esResult] = await Promise.all([
    computeSymbol("NQ", MARKET_TICKERS.NQ),
    computeSymbol("ES", MARKET_TICKERS.ES),
  ]);

  const nq = nqResult.context;
  const es = esResult.context;

  return {
    nq,
    es,
    relativeStrength: computeRelativeStrength(nq, es),
    smt: detectSmt(nq, es, nqResult.bars1h, esResult.bars1h),
  };
}

export async function computeMarketRadarStatus(): Promise<MarketContext> {
  return computeMarketContext();
}
