import { MARKET_TICKERS } from "@/lib/chart-data";
import {
  quoteAgeSec,
  withQuoteMeta,
  type LiveQuote,
} from "@/lib/live-quote-types";

const PRICE_SCALE = 1e-9;
const DATASET = "GLBX.MDP3";

/** Yahoo ticker → Databento continuous symbol (same as briefing / market-data). */
const TICKER_TO_DATABENTO: Record<string, string> = {
  [MARKET_TICKERS.NQ]: "NQ.c.0",
  [MARKET_TICKERS.ES]: "ES.c.0",
  [MARKET_TICKERS.GC]: "GC.c.0",
};

type DatabentoOhlcvRow = {
  ts_event?: number;
  hd?: { ts_event?: number };
  open?: number;
  high?: number;
  low?: number;
  close?: number;
};

function isoUtc(d: Date): string {
  return d.toISOString().slice(0, 19);
}

function parseRows(text: string): DatabentoOhlcvRow[] {
  const rows: DatabentoOhlcvRow[] = [];
  for (const line of text.trim().split("\n")) {
    if (!line) continue;
    try {
      rows.push(JSON.parse(line) as DatabentoOhlcvRow);
    } catch {
      /* skip malformed */
    }
  }
  return rows;
}

function rowToBar(row: DatabentoOhlcvRow): LiveQuote["bar"] | null {
  const tsNs = row.ts_event ?? row.hd?.ts_event;
  if (tsNs == null) return null;

  const open = Number(row.open) * PRICE_SCALE;
  const high = Number(row.high) * PRICE_SCALE;
  const low = Number(row.low) * PRICE_SCALE;
  const close = Number(row.close) * PRICE_SCALE;

  if (
    !Number.isFinite(open) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    !Number.isFinite(close) ||
    close <= 0
  ) {
    return null;
  }

  return {
    time: Math.floor(Number(tsNs) / 1_000_000_000),
    open,
    high,
    low,
    close,
  };
}

/** Latest 1m bar from Databento GLBX — near real-time when API key has live access. */
export async function fetchDatabentoLiveQuote(
  ticker: string
): Promise<LiveQuote | null> {
  const apiKey = process.env.DATABENTO_API_KEY;
  const symbol = TICKER_TO_DATABENTO[ticker];
  if (!apiKey || !symbol) return null;

  const end = new Date(Date.now() + 60_000);
  const start = new Date(Date.now() - 45 * 60_000);

  const params = new URLSearchParams({
    dataset: DATASET,
    schema: "ohlcv-1m",
    symbols: symbol,
    stype_in: "continuous",
    stype_out: "instrument_id",
    encoding: "json",
    start: isoUtc(start),
    end: isoUtc(end),
  });

  const res = await fetch(
    `https://hist.databento.com/v0/timeseries.get_range?${params}`,
    {
      method: "GET",
      headers: {
        Authorization: `Basic ${btoa(`${apiKey}:`)}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Databento ${res.status}: ${body.slice(0, 200)}`);
  }

  const rows = parseRows(await res.text());
  if (!rows.length) return null;

  const bar = rowToBar(rows[rows.length - 1]!);
  if (!bar) return null;

  const fetchedAt = Date.now();
  const delaySec = quoteAgeSec(bar.time, fetchedAt);

  // Reject if Databento data is as stale as delayed Yahoo (~10m).
  if (delaySec > 120) return null;

  return withQuoteMeta({
    ticker,
    price: bar.close,
    previousClose: null,
    quoteTime: bar.time,
    bar,
    fetchedAt,
    source: "databento",
  });
}
