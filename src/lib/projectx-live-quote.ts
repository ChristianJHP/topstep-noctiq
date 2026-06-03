import { MARKET_TICKERS } from "@/lib/chart-data";
import { withQuoteMeta, type LiveQuote } from "@/lib/live-quote-types";

const BASE_URL = "https://api.topstepx.com/api";

/** Yahoo ticker → ProjectX contract search text. */
const TICKER_TO_SEARCH: Record<string, string> = {
  [MARKET_TICKERS.NQ]: "NQ",
  [MARKET_TICKERS.ES]: "ES",
  [MARKET_TICKERS.GC]: "GC",
};

type TokenCache = { token: string; expires: number };
type ContractCache = { id: string; expires: number };

let tokenCache: TokenCache | null = null;
const contractCache = new Map<string, ContractCache>();

async function getToken(): Promise<string | null> {
  const username = process.env.PROJECTX_USERNAME;
  const apiKey = process.env.PROJECTX_API_KEY;
  if (!username || !apiKey) return null;

  if (tokenCache && tokenCache.expires > Date.now()) {
    return tokenCache.token;
  }

  const res = await fetch(`${BASE_URL}/Auth/loginKey`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userName: username,
      apiKey,
      authType: "api_key",
    }),
    cache: "no-store",
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { token?: string; authToken?: string };
  const token = data.token ?? data.authToken;
  if (!token) return null;

  tokenCache = { token, expires: Date.now() + 50 * 60_000 };
  return token;
}

async function getContractId(
  token: string,
  searchText: string
): Promise<string | null> {
  const cached = contractCache.get(searchText);
  if (cached && cached.expires > Date.now()) return cached.id;

  const res = await fetch(`${BASE_URL}/Contract/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ searchText, live: true }),
    cache: "no-store",
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    contracts?: Array<{ id?: string; name?: string; symbol?: string }>;
  };

  const contracts = data.contracts ?? [];
  const match =
    contracts.find(
      (c) =>
        c.name?.includes(searchText) ||
        c.symbol?.includes(searchText) ||
        c.name?.includes(`/${searchText}`)
    ) ?? contracts[0];

  const id = match?.id;
  if (!id) return null;

  contractCache.set(searchText, {
    id,
    expires: Date.now() + 6 * 60 * 60_000,
  });
  return id;
}

type PxBar = { t?: string; o?: number; h?: number; l?: number; c?: number };

/** TopstepX sim/live bars — real-time when ProjectX credentials are configured. */
export async function fetchProjectXLiveQuote(
  ticker: string
): Promise<LiveQuote | null> {
  const searchText = TICKER_TO_SEARCH[ticker];
  if (!searchText) return null;

  const token = await getToken();
  if (!token) return null;

  const contractId = await getContractId(token, searchText);
  if (!contractId) return null;

  const endTime = new Date().toISOString();
  const startTime = new Date(Date.now() - 30 * 60_000).toISOString();

  const res = await fetch(`${BASE_URL}/History/retrieveBars`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contractId,
      live: true,
      startTime,
      endTime,
      unit: 2,
      unitNumber: 1,
      limit: 5,
      includePartialBar: true,
    }),
    cache: "no-store",
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { bars?: PxBar[] };
  const bars = data.bars ?? [];
  const last = bars[bars.length - 1];
  if (!last?.c || last.c <= 0) return null;

  const quoteTime = last.t
    ? Math.floor(new Date(last.t).getTime() / 1000)
    : Math.floor(Date.now() / 1000);

  const bar =
    last.o != null && last.h != null && last.l != null
      ? {
          time: quoteTime,
          open: last.o,
          high: last.h,
          low: last.l,
          close: last.c,
        }
      : null;

  const fetchedAt = Date.now();

  return withQuoteMeta({
    ticker,
    price: last.c,
    previousClose: null,
    quoteTime,
    bar,
    fetchedAt,
    source: "projectx",
  });
}
