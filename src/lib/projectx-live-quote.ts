import { MARKET_TICKERS } from "@/lib/chart-data";
import { withQuoteMeta, type LiveQuote } from "@/lib/live-quote-types";

const BASE_URL = "https://api.topstepx.com/api";

/** Yahoo ticker → ProjectX contract search text. */
const TICKER_TO_SEARCH: Record<string, string> = {
  [MARKET_TICKERS.NQ]: "NQ",
  [MARKET_TICKERS.ES]: "ES",
  [MARKET_TICKERS.GC]: "GC",
};

type PxContract = {
  id?: string;
  name?: string;
  description?: string;
  symbolId?: string;
  activeContract?: boolean;
};

type TokenCache = { token: string; expires: number };
type ContractCache = { id: string; expires: number };

let tokenCache: TokenCache | null = null;
const contractCache = new Map<string, ContractCache>();

function parseContracts(data: unknown): PxContract[] {
  if (Array.isArray(data)) return data as PxContract[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.contracts)) return o.contracts as PxContract[];
    if (Array.isArray(o.results)) return o.results as PxContract[];
    if (o.id) return [o as PxContract];
  }
  return [];
}

function parseBars(data: unknown): Array<{
  t?: string;
  o?: number;
  h?: number;
  l?: number;
  c?: number;
}> {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.bars)) return o.bars as ReturnType<typeof parseBars>;
  }
  return [];
}

function pickContract(
  contracts: PxContract[],
  searchText: string
): PxContract | null {
  const active = contracts.filter((c) => c.activeContract !== false);
  const pool = active.length ? active : contracts;

  if (searchText === "NQ") {
    return (
      pool.find((c) => c.symbolId === "F.US.ENQ") ??
      pool.find((c) =>
        c.description?.toLowerCase().includes("nasdaq-100")
      ) ??
      pool.find((c) => c.name?.startsWith("NQ") && !c.name?.startsWith("NQG")) ??
      pool[0] ??
      null
    );
  }

  if (searchText === "ES") {
    return (
      pool.find((c) => c.symbolId === "F.US.ES") ??
      pool.find((c) => c.description?.toLowerCase().includes("e-mini s&p")) ??
      pool.find((c) => c.name?.startsWith("ES")) ??
      pool[0] ??
      null
    );
  }

  if (searchText === "GC") {
    return (
      pool.find((c) => c.symbolId === "F.US.GCE") ??
      pool.find((c) => c.description?.toLowerCase().includes("gold")) ??
      pool.find((c) => c.name?.startsWith("GC")) ??
      pool[0] ??
      null
    );
  }

  return pool[0] ?? null;
}

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

  const data: unknown = await res.json();
  const token =
    typeof data === "string"
      ? data
      : ((data as { token?: string; authToken?: string }).token ??
        (data as { token?: string; authToken?: string }).authToken);
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

  // Topstep combine uses sim subscription — live:false is the real-time sim feed.
  const res = await fetch(`${BASE_URL}/Contract/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ searchText, live: false }),
    cache: "no-store",
  });

  if (!res.ok) return null;

  const contracts = parseContracts(await res.json());
  const match = pickContract(contracts, searchText);
  const id = match?.id;
  if (!id) return null;

  contractCache.set(searchText, {
    id,
    expires: Date.now() + 6 * 60 * 60_000,
  });
  return id;
}

async function fetchBars(
  token: string,
  contractId: string,
  live: boolean
): Promise<ReturnType<typeof parseBars>> {
  const endTime = new Date().toISOString();
  const startTime = new Date(Date.now() - 15 * 60_000).toISOString();

  const res = await fetch(`${BASE_URL}/History/retrieveBars`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contractId,
      live,
      startTime,
      endTime,
      unit: 2,
      unitNumber: 1,
      limit: 3,
      includePartialBar: true,
    }),
    cache: "no-store",
  });

  if (!res.ok) return [];
  return parseBars(await res.json());
}

function barsToQuote(ticker: string, bars: ReturnType<typeof parseBars>): LiveQuote | null {
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

  return withQuoteMeta({
    ticker,
    price: last.c,
    previousClose: null,
    quoteTime,
    bar,
    fetchedAt: Date.now(),
    source: "projectx",
  });
}

/** TopstepX sim bars — real-time on combine; use live:false per ProjectX docs. */
export async function fetchProjectXLiveQuote(
  ticker: string
): Promise<LiveQuote | null> {
  const searchText = TICKER_TO_SEARCH[ticker];
  if (!searchText) return null;

  const token = await getToken();
  if (!token) return null;

  const contractId = await getContractId(token, searchText);
  if (!contractId) return null;

  // Sim feed first (Topstep combine), then exchange live subscription.
  for (const live of [false, true] as const) {
    const bars = await fetchBars(token, contractId, live);
    const quote = barsToQuote(ticker, bars);
    if (quote && quote.delaySec <= 120) return quote;
  }

  return null;
}
