import { fetchDatabentoLiveQuote } from "@/lib/databento-live-quote";
import { fetchProjectXLiveQuote } from "@/lib/projectx-live-quote";
import { fetchYahooLiveQuote } from "@/lib/yahoo-live-quote";
import type { LiveQuote } from "@/lib/live-quote-types";

/** Prefer Databento → ProjectX → Yahoo (Yahoo =F futures are ~10m delayed). */
export async function fetchLiveQuote(ticker: string): Promise<LiveQuote> {
  if (process.env.DATABENTO_API_KEY) {
    try {
      const db = await fetchDatabentoLiveQuote(ticker);
      if (db) return db;
    } catch (error) {
      console.error("[live-quote/databento]", ticker, error);
    }
  }

  if (process.env.PROJECTX_API_KEY && process.env.PROJECTX_USERNAME) {
    try {
      const px = await fetchProjectXLiveQuote(ticker);
      if (px && px.delaySec <= 120) return px;
    } catch (error) {
      console.error("[live-quote/projectx]", ticker, error);
    }
  }

  return fetchYahooLiveQuote(ticker);
}
