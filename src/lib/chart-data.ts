export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

/** Yahoo Finance tickers for NQ / ES futures */
export const MARKET_TICKERS = {
  NQ: "NQ=F",
  ES: "ES=F",
} as const;

export async function fetchCandles(ticker: string): Promise<Candle[]> {
  const url = new URL(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`
  );
  url.searchParams.set("interval", "60m");
  url.searchParams.set("range", "5d");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`Chart data unavailable (${res.status})`);
  }

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];

  if (!quote || timestamps.length === 0) {
    throw new Error("No chart data returned");
  }

  const candles: Candle[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];

    if (
      open == null ||
      high == null ||
      low == null ||
      close == null ||
      Number.isNaN(open)
    ) {
      continue;
    }

    candles.push({
      time: timestamps[i],
      open,
      high,
      low,
      close,
    });
  }

  return candles;
}
