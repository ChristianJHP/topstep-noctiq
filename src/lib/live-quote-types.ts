export type LiveQuoteBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type LiveQuoteSource = "databento" | "projectx" | "yahoo";

export type LiveQuote = {
  ticker: string;
  price: number;
  /** Prior settlement — matches TradingView / Yahoo day-change %. */
  previousClose: number | null;
  /** Unix seconds — exchange / bar timestamp for the quote. */
  quoteTime: number;
  /** Forming 1m bar at quoteTime (if available). */
  bar: LiveQuoteBar | null;
  fetchedAt: number;
  source: LiveQuoteSource;
  /** Seconds between quoteTime and fetch — 0 when real-time. */
  delaySec: number;
};

export function quoteAgeSec(quoteTimeSec: number, nowMs = Date.now()): number {
  return Math.max(0, Math.round((nowMs - quoteTimeSec * 1000) / 1000));
}

export function withQuoteMeta(
  quote: Omit<LiveQuote, "source" | "delaySec"> & {
    source: LiveQuoteSource;
  }
): LiveQuote {
  return {
    ...quote,
    delaySec: quoteAgeSec(quote.quoteTime, quote.fetchedAt),
  };
}
