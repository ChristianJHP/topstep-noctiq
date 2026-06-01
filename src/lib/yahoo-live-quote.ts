import { MARKET_TICKERS } from "@/lib/chart-data";

export type LiveQuote = {
  ticker: string;
  price: number;
  /** Unix seconds — when Yahoo last updated the quote. */
  quoteTime: number;
  /** Forming 1m bar at quoteTime (if available). */
  bar: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
  } | null;
  fetchedAt: number;
};

type YahooChartResult = {
  meta?: {
    regularMarketPrice?: number;
    regularMarketTime?: number;
  };
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      open?: (number | null)[];
      high?: (number | null)[];
      low?: (number | null)[];
      close?: (number | null)[];
    }>;
  };
};

export async function fetchYahooLiveQuote(
  ticker: string = MARKET_TICKERS.NQ
): Promise<LiveQuote> {
  const url = new URL(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`
  );
  url.searchParams.set("interval", "1m");
  url.searchParams.set("range", "1d");
  url.searchParams.set("includePrePost", "true");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Yahoo quote ${res.status}`);
  }

  const json = (await res.json()) as { chart?: { result?: YahooChartResult[] } };
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("Yahoo quote empty");

  const meta = result.meta;
  const timestamps = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0];

  let bar: LiveQuote["bar"] = null;
  if (timestamps.length && q) {
    const i = timestamps.length - 1;
    const open = q.open?.[i];
    const high = q.high?.[i];
    const low = q.low?.[i];
    const close = q.close?.[i];
    if (
      open != null &&
      high != null &&
      low != null &&
      close != null &&
      !Number.isNaN(open)
    ) {
      bar = {
        time: timestamps[i]!,
        open,
        high,
        low,
        close,
      };
    }
  }

  const price =
    meta?.regularMarketPrice ??
    bar?.close ??
    bar?.open ??
    0;

  const quoteTime =
    meta?.regularMarketTime ?? bar?.time ?? Math.floor(Date.now() / 1000);

  return {
    ticker,
    price,
    quoteTime,
    bar,
    fetchedAt: Date.now(),
  };
}
