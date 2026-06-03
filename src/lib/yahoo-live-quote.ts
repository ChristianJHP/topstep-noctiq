import { MARKET_TICKERS } from "@/lib/chart-data";
import {
  quoteAgeSec,
  withQuoteMeta,
  type LiveQuote,
} from "@/lib/live-quote-types";

export type { LiveQuote, LiveQuoteBar, LiveQuoteSource } from "@/lib/live-quote-types";

type YahooChartResult = {
  meta?: {
    regularMarketPrice?: number;
    regularMarketTime?: number;
    previousClose?: number;
    chartPreviousClose?: number;
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

/** Yahoo =F chart API — free but ~10 minute delayed on CME futures. */
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

  const previousClose =
    meta?.previousClose ?? meta?.chartPreviousClose ?? null;

  const fetchedAt = Date.now();

  return withQuoteMeta({
    ticker,
    price,
    previousClose:
      previousClose != null && Number.isFinite(previousClose)
        ? previousClose
        : null,
    quoteTime,
    bar,
    fetchedAt,
    source: "yahoo",
  });
}

/** True when quote is older than acceptable for live UI (Yahoo ~600s). */
export function isLiveQuoteStale(
  quote: LiveQuote,
  maxAgeSec = 90
): boolean {
  return quoteAgeSec(quote.quoteTime, quote.fetchedAt) > maxAgeSec;
}
