import { unstable_cache } from "next/cache";
import Parser from "rss-parser";
import {
  filterMarketMovingHeadlines,
  type MarketMovingHeadline,
} from "@/lib/headline-classifier";

const FJ_RSS = "https://www.financialjuice.com/feed.ashx?xy=rss";

const YAHOO_FEEDS = [
  "https://feeds.finance.yahoo.com/rss/2.0/headline?s=NQ=F&region=US&lang=en-US",
  "https://feeds.finance.yahoo.com/rss/2.0/headline?s=ES=F&region=US&lang=en-US",
  "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC&region=US&lang=en-US",
];

export interface Headline {
  title: string;
  link: string;
  publishedAt: string;
}

export type HeadlinesSource = "financialjuice" | "yahoo" | "mixed" | "none";

export type HeadlinesPayload = {
  marketMoving: MarketMovingHeadline[];
  raw: Headline[];
  source: HeadlinesSource;
};

function stripPrefix(title: string): string {
  return title.replace(/^FinancialJuice:\s*/i, "").trim();
}

function parseItems(
  items: Parser.Item[],
  stripFj?: boolean
): Headline[] {
  return (items ?? [])
    .map((item) => ({
      title: stripFj
        ? stripPrefix(item.title ?? "")
        : (item.title ?? "").trim(),
      link: item.link ?? item.guid ?? "",
      publishedAt: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
    }))
    .filter((h) => h.title && h.link);
}

async function fetchFjRaw(): Promise<Headline[]> {
  const parser = new Parser({
    timeout: 12_000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  });

  const feed = await parser.parseURL(FJ_RSS);
  return parseItems(feed.items ?? [], true).slice(0, 30);
}

async function fetchYahooRaw(): Promise<Headline[]> {
  const parser = new Parser({
    timeout: 12_000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  const seen = new Set<string>();
  const merged: Headline[] = [];

  for (const url of YAHOO_FEEDS) {
    try {
      const feed = await parser.parseURL(url);
      for (const h of parseItems(feed.items ?? [])) {
        const key = h.link || h.title;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(h);
      }
    } catch (e) {
      console.warn("[headlines] Yahoo feed failed:", url, (e as Error).message);
    }
  }

  return merged;
}

function mergeByDate(...lists: Headline[][]): Headline[] {
  const seen = new Set<string>();
  const all: Headline[] = [];

  for (const list of lists) {
    for (const h of list) {
      const key = h.link || h.title;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(h);
    }
  }

  return all.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

async function fetchHeadlinesUncached(): Promise<HeadlinesPayload> {
  let fj: Headline[] = [];
  let yahoo: Headline[] = [];

  try {
    fj = await fetchFjRaw();
  } catch (e) {
    console.warn("[headlines] FinancialJuice failed:", (e as Error).message);
  }

  try {
    yahoo = await fetchYahooRaw();
  } catch (e) {
    console.warn("[headlines] Yahoo failed:", (e as Error).message);
  }

  const raw = mergeByDate(fj, yahoo).slice(0, 40);
  const marketMoving = filterMarketMovingHeadlines(raw, 5);

  let source: HeadlinesSource = "none";
  if (fj.length > 0 && yahoo.length > 0) source = "mixed";
  else if (fj.length > 0) source = "financialjuice";
  else if (yahoo.length > 0) source = "yahoo";

  return { marketMoving, raw, source };
}

const getCachedHeadlines = unstable_cache(
  fetchHeadlinesUncached,
  ["market-headlines-v3"],
  { revalidate: 120, tags: ["headlines"] }
);

export async function fetchHeadlinesMeta(): Promise<HeadlinesPayload> {
  return getCachedHeadlines();
}

/** @deprecated Use fetchHeadlinesMeta */
export async function fetchFilteredHeadlines(): Promise<Headline[]> {
  const { marketMoving } = await getCachedHeadlines();
  return marketMoving;
}
