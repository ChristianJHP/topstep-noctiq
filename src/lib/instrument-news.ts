import type { ContextFeedRow, GeoHeadline, MarketNewsItem } from "@/lib/geopolitics-sources";
import {
  classifyNewsHeadline,
  shortHeadline,
  whyItMattersFor,
  type ContextFeedCategory,
  type NewsLabel,
} from "@/lib/news-tags";

export type InstrumentNewsLabel = "NQ" | "ES" | "GC";

/** How relevant a headline is to the active futures symbol. */
export function instrumentNewsScore(
  instrument: InstrumentNewsLabel,
  text: string,
  topics: string[] = [],
  newsLabel?: NewsLabel
): number {
  const t = text.toLowerCase();
  let score = 0;

  if (newsLabel === "MUST KNOW") score += 12;
  else if (newsLabel === "GEO" || newsLabel === "HIGH IMPACT") score += 8;
  else if (newsLabel === "DATA" || newsLabel === "MACRO") score += 6;

  if (instrument === "GC") {
    if (/gold|bullion|precious metal|comex|xau|safe.?haven|haven bid|haven demand/i.test(t)) {
      score += 45;
    }
    if (/dollar|dxy|greenback|usd index|real yield|treasury yield|bond yield|yields/i.test(t)) {
      score += 28;
    }
    if (/oil|opec|crude|refinery|energy|pipeline|petroleum/i.test(t)) score += 24;
    if (/iran|russia|ukraine|war|strike|missile|sanction|geopolit|conflict|military/i.test(t)) {
      score += 22;
    }
    if (/inflation|cpi|fed|fomc|rate cut|rate hike|central bank|pce/i.test(t)) score += 20;
    if (topics.includes("ENERGY")) score += 18;
    if (topics.includes("GEO")) score += 14;
    if (topics.includes("GOLD")) score += 22;
    if (/nasdaq|semiconductor|nvidia|mag 7|mega.?cap tech|qqq/i.test(t)) score -= 18;
  }

  if (instrument === "NQ") {
    if (/nasdaq|\bnq\b|tech|semiconductor|chip|nvidia|nvda|mega.?cap|mag 7|growth|qqq|ai stock/i.test(t)) {
      score += 38;
    }
    if (/fed|fomc|cpi|nfp|payroll|yields|rates|inflation|gdp|employment/i.test(t)) score += 24;
    if (/tariff|trade war|white house|policy|treasury/i.test(t)) score += 16;
    if (/risk.?off|volatility|vix|selloff|rally/i.test(t)) score += 12;
    if (topics.includes("SEMIS")) score += 20;
    if (topics.includes("NQ")) score += 18;
    if (topics.includes("MACRO")) score += 10;
    if (/gold|bullion|comex|xau/i.test(t) && !/risk|war|inflation|fed|dollar|yield/i.test(t)) {
      score -= 10;
    }
  }

  if (instrument === "ES") {
    if (/s&p|sp500|\bes\b|equity index|broad market|financials|bank stock|large.?cap/i.test(t)) {
      score += 34;
    }
    if (/fed|fomc|cpi|nfp|payroll|ism|pmi|gdp|employment|pce|inflation/i.test(t)) score += 30;
    if (/tariff|fiscal|white house|policy|treasury|trade deal/i.test(t)) score += 20;
    if (/earnings|guidance|revenue/i.test(t)) score += 10;
    if (topics.includes("MACRO")) score += 12;
    if (topics.includes("ES")) score += 16;
    if (/gold|bullion|oil/i.test(t) && !/risk|inflation|war|fed|dollar|yield|sanction/i.test(t)) {
      score -= 6;
    }
  }

  // Shared macro/geo still matters — ES/NQ slightly less on pure energy without risk tone
  if (instrument !== "GC" && topics.includes("ENERGY") && /risk|strike|war|sanction/i.test(t)) {
    score += 10;
  }

  return score;
}

function combinedScore(
  instrument: InstrumentNewsLabel,
  item: Pick<MarketNewsItem, "text" | "topics" | "label" | "impactScore">
): number {
  return (
    instrumentNewsScore(instrument, item.text, item.topics, item.label) +
    item.impactScore * 0.12
  );
}

/** Rank and trim the wire feed for the active symbol tab. */
export function filterNewsForInstrument(
  feed: MarketNewsItem[],
  instrument: InstrumentNewsLabel,
  limit = 10
): MarketNewsItem[] {
  if (!feed.length) return [];

  const ranked = feed
    .map((item, index) => ({
      item,
      index,
      score: combinedScore(instrument, item),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const relevant = ranked.filter((row) => row.score >= 8);
  const pool = relevant.length >= 3 ? relevant : ranked;

  return pool.slice(0, limit).map((row) => row.item);
}

function whyForInstrument(
  instrument: InstrumentNewsLabel,
  category: ContextFeedCategory,
  text: string,
  topics: string[]
): string {
  const base = whyItMattersFor(category, text, topics);

  if (instrument === "GC") {
    if (category === "GEO" && topics.includes("ENERGY")) {
      return "Energy / geopolitical tone for gold";
    }
    if (category === "GEO") return "Safe-haven / geopolitical tone for gold";
    if (category === "POLICY") return "Dollar / inflation sensitivity for gold";
    if (category === "DATA") return "Rates / macro context for gold";
  }
  if (instrument === "NQ") {
    if (category === "GEO") return "Risk sentiment for Nasdaq";
    if (category === "POLICY") return "Growth / rates sensitivity for NQ";
    if (category === "DATA") return "Macro catalyst for index futures";
  }
  if (instrument === "ES") {
    if (category === "GEO") return "Broad risk tone for S&P";
    if (category === "POLICY") return "Policy / tariff context for ES";
    if (category === "DATA") return "Macro release for index futures";
  }

  return base;
}

/** Top 3 catalyst rows — same categories, instrument-ranked picks. */
export function buildInstrumentContextFeed(
  feed: MarketNewsItem[],
  headlines: GeoHeadline[],
  instrument: InstrumentNewsLabel
): ContextFeedRow[] {
  const rows: ContextFeedRow[] = [];
  const used = new Set<string>();

  const candidates: { text: string; link: string | null; tags: ReturnType<typeof classifyNewsHeadline> }[] =
    [];

  for (const item of feed) {
    candidates.push({
      text: item.text,
      link: item.link,
      tags: classifyNewsHeadline(item.text),
    });
  }
  for (const h of headlines) {
    candidates.push({
      text: h.title,
      link: h.link,
      tags: classifyNewsHeadline(h.title),
    });
  }

  const tryAdd = (category: ContextFeedCategory) => {
    const pool = candidates
      .filter((c) => c.tags.contextCategory === category)
      .map((c) => ({
        ...c,
        score:
          instrumentNewsScore(instrument, c.text, c.tags.topics, c.tags.label) +
          c.tags.impactScore * 0.12,
      }))
      .sort((a, b) => b.score - a.score);

    const pick = pool[0];
    if (!pick || pick.score < 6) return;

    const text = shortHeadline(pick.text, 56);
    const key = `${category}:${text}`;
    if (used.has(key)) return;
    used.add(key);

    rows.push({
      category,
      text,
      link: pick.link,
      whyItMatters: whyForInstrument(instrument, category, pick.text, pick.tags.topics),
    });
  };

  for (const cat of ["GEO", "POLICY", "DATA"] as ContextFeedCategory[]) {
    tryAdd(cat);
  }

  if (rows.length < 3) {
    const fallback = [...feed]
      .map((item) => ({
        item,
        score: combinedScore(instrument, item),
      }))
      .sort((a, b) => b.score - a.score);

    for (const { item, score } of fallback) {
      if (rows.length >= 3 || score < 6) break;
      const text = shortHeadline(item.text, 56);
      const tags = classifyNewsHeadline(item.text);
      const category = tags.contextCategory ?? "WATCH";
      const key = `${category}:${text}`;
      if (used.has(key)) continue;
      used.add(key);
      rows.push({
        category,
        text,
        link: item.link,
        whyItMatters: whyForInstrument(instrument, category, item.text, tags.topics),
      });
    }
  }

  return rows.slice(0, 3);
}

export function topCatalystForInstrument(
  feed: MarketNewsItem[],
  instrument: InstrumentNewsLabel
): string | null {
  const ranked = filterNewsForInstrument(feed, instrument, 5);
  const top = ranked.find((f) => f.label === "MUST KNOW") ?? ranked[0];
  if (!top) return null;

  const t = top.text.replace(/^FinancialJuice:\s*/i, "").trim();
  const clause = t.split(/[;,]/)[0]?.trim() ?? t;
  if (clause.length <= 52) return clause;
  return `${clause.slice(0, 51).trim()}…`;
}

export function instrumentNewsSubtitle(instrument: InstrumentNewsLabel): string {
  if (instrument === "GC") return "Live · Gold catalysts";
  if (instrument === "ES") return "Live · ES catalysts";
  return "Live · NQ catalysts";
}
