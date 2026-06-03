import { fetchDatabentoLiveQuote } from "@/lib/databento-live-quote";
import { withTimeout } from "@/lib/fetch-timeout";
import { fetchProjectXLiveQuote } from "@/lib/projectx-live-quote";
import { fetchYahooLiveQuote } from "@/lib/yahoo-live-quote";
import type { LiveQuote } from "@/lib/live-quote-types";

const PROJECTX_TIMEOUT_MS = 10_000;
const DATABENTO_TIMEOUT_MS = 16_000;
const TOTAL_TIMEOUT_MS = 22_000;

/** Prefer ProjectX (Topstep sim) → Databento → Yahoo (=F is ~10m delayed). */
export async function fetchLiveQuote(ticker: string): Promise<LiveQuote> {
  return withTimeout(fetchLiveQuoteInner(ticker), TOTAL_TIMEOUT_MS, "live quote");
}

async function fetchLiveQuoteInner(ticker: string): Promise<LiveQuote> {
  if (process.env.PROJECTX_API_KEY && process.env.PROJECTX_USERNAME) {
    try {
      const px = await withTimeout(
        fetchProjectXLiveQuote(ticker),
        PROJECTX_TIMEOUT_MS,
        "projectx quote"
      );
      if (px && px.delaySec <= 120) return px;
    } catch (error) {
      console.error("[live-quote/projectx]", ticker, error);
    }
  }

  if (process.env.DATABENTO_API_KEY) {
    try {
      const db = await withTimeout(
        fetchDatabentoLiveQuote(ticker),
        DATABENTO_TIMEOUT_MS,
        "databento quote"
      );
      if (db && db.delaySec <= 120) return db;
    } catch (error) {
      console.error("[live-quote/databento]", ticker, error);
    }
  }

  const yahoo = await fetchYahooLiveQuote(ticker);
  console.warn(
    `[live-quote] ${ticker} falling back to delayed Yahoo (${yahoo.delaySec}s)`
  );
  return yahoo;
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
