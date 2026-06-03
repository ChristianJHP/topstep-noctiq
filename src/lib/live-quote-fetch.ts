import { fetchDatabentoLiveQuote } from "@/lib/databento-live-quote";
import { withTimeout } from "@/lib/fetch-timeout";
import { fetchProjectXLiveQuote } from "@/lib/projectx-live-quote";
import { fetchYahooLiveQuote } from "@/lib/yahoo-live-quote";
import type { LiveQuote } from "@/lib/live-quote-types";

const SOURCE_TIMEOUT_MS = 2_500;
const TOTAL_TIMEOUT_MS = 5_000;

/** Prefer Databento → ProjectX → Yahoo (Yahoo =F futures are ~10m delayed). */
export async function fetchLiveQuote(ticker: string): Promise<LiveQuote> {
  return withTimeout(fetchLiveQuoteInner(ticker), TOTAL_TIMEOUT_MS, "live quote");
}

async function fetchLiveQuoteInner(ticker: string): Promise<LiveQuote> {
  if (process.env.DATABENTO_API_KEY) {
    try {
      const db = await withTimeout(
        fetchDatabentoLiveQuote(ticker),
        SOURCE_TIMEOUT_MS,
        "databento quote"
      );
      if (db) return db;
    } catch (error) {
      console.error("[live-quote/databento]", ticker, error);
    }
  }

  if (process.env.PROJECTX_API_KEY && process.env.PROJECTX_USERNAME) {
    try {
      const px = await withTimeout(
        fetchProjectXLiveQuote(ticker),
        SOURCE_TIMEOUT_MS,
        "projectx quote"
      );
      if (px && px.delaySec <= 120) return px;
    } catch (error) {
      console.error("[live-quote/projectx]", ticker, error);
    }
  }

  return fetchYahooLiveQuote(ticker);
}

/** Optional live price for trade-map refresh — never throws or blocks long. */
export async function tryLivePrice(
  ticker: string,
  maxDelaySec = 120
): Promise<number | null> {
  try {
    const live = await fetchLiveQuote(ticker);
    if (live.price > 0 && live.delaySec <= maxDelaySec) {
      return Math.round(live.price);
    }
  } catch {
    /* caller falls back to candle close */
  }
  return null;
}
