import { fetchHeadlinesMeta, type Headline } from "@/lib/headlines";
import { classifyHeadline } from "@/lib/headline-classifier";
import {
  fetchRecentTrumpPosts,
  type TrumpPost,
} from "@/lib/truthsocial-fetch";

export type GeoHeadline = {
  title: string;
  link: string;
  publishedAt: string;
};

export type GeopoliticsSources = {
  headlines: GeoHeadline[];
  trumpPosts: TrumpPost[];
  trumpGeoPosts: TrumpPost[];
};

export type MarketNewsItem = {
  id: string;
  kind: "headline" | "trump";
  text: string;
  link: string | null;
  publishedAt: string;
};

/** Market-wrap slop — not war news. */
const HEADLINE_JUNK: RegExp[] = [
  /dow jones/i,
  /\bs&p\b/i,
  /nasdaq/i,
  /\bstock(s)?\b/i,
  /nvidia/i,
  /tesla/i,
  /buy point/i,
  /near buy/i,
  /\btitans\b/i,
  /futures loom/i,
  /futures:/i,
  /market rally/i,
  /market dive/i,
  /wall street/i,
  /price target/i,
  /earnings/i,
  /investors/i,
  /lead \d/i,
  /things to know/i,
  /could it make you/i,
  /motley fool/i,
  /analyst/i,
  /megacap/i,
  /bitcoin/i,
  /this move/i,
  /make this .* move/i,
  /futures rise/i,
  /futures fall/i,
  /futures edge/i,
  /futures slip/i,
  /futures jump/i,
  /market wrap/i,
  /morning brief/i,
  /what to watch/i,
  /stocks to watch/i,
  /premarket/i,
  /after hours/i,
  /sector rotation/i,
  /chip stock/i,
  /ai stock/i,
  /mag 7/i,
  /magnificent seven/i,
];

/**
 * War / negotiation / conflict updates only — not bare country names in stock headlines.
 */
const WAR_UPDATE_PATTERNS: RegExp[] = [
  /negotiat/i,
  /peace talk/i,
  /diplomat/i,
  /ceasefire/i,
  /de-escalat/i,
  /escalat/i,
  /\bwar\b/i,
  /\bconflict\b/i,
  /sanction/i,
  /missile/i,
  /airstrike/i,
  /strike on/i,
  /attacks? on/i,
  /invad/i,
  /\btroops\b/i,
  /\bmilitary\b/i,
  /nuclear/i,
  /houthi/i,
  /red sea/i,
  /strait of hormuz/i,
  /hamas/i,
  /hezbollah/i,
  /gaza/i,
  /trade war/i,
  /iran.{0,45}(attack|strike|missile|sanction|nuclear|talk|deal|negotiat|war|conflict|bomb|military)/i,
  /(attack|strike|missile|sanction|nuclear|talk|deal|negotiat|war|conflict|bomb|military).{0,45}iran/i,
  /israel.{0,40}(attack|strike|missile|war|ceasefire|hamas|gaza|bomb|military)/i,
  /(attack|strike|missile|war|ceasefire|bomb|military).{0,40}israel/i,
  /ukraine.{0,40}(attack|strike|missile|war|peace|negotiat|ceasefire|invasion|russia)/i,
  /russia.{0,40}(attack|strike|missile|war|ukraine|sanction|invasion|peace|negotiat)/i,
  /china.{0,40}(tariff|sanction|taiwan|trade war|military)/i,
  /taiwan.{0,30}(strait|invasion|military|china|conflict)/i,
  /pentagon/i,
  /defense secretary/i,
  /state department.{0,30}(talk|deal|sanction)/i,
  /white house.{0,40}(iran|israel|ukraine|war|sanction|deal|negotiat)/i,
  /trump.{0,50}(iran|israel|ukraine|russia|war|sanction|ceasefire|negotiat|deal|strike|military|tariff)/i,
  /(iran|israel|ukraine|russia).{0,50}trump.{0,50}(deal|talk|sanction|war|strike|negotiat)/i,
  /\bdrone strike/i,
  /\bkyiv\b/i,
  /\bcentcom\b/i,
  /us-iran/i,
  /\btaiwan\b/i,
  /russia.{0,80}(strike|attack|drone|refinery|war|ukraine)/i,
];

const TRUMP_WAR_PATTERNS: RegExp[] = [
  ...WAR_UPDATE_PATTERNS,
  /\biran\b/i,
  /\bisrael\b/i,
  /\bukraine\b/i,
  /\brussia\b/i,
  /end the war/i,
  /stop the war/i,
  /peace deal/i,
  /sanction/i,
  /tariff/i,
  /nato/i,
  /military/i,
];

function isJunkHeadline(title: string): boolean {
  return HEADLINE_JUNK.some((p) => p.test(title));
}

const GEO_IMPORTANT_HINT =
  /(iran|israel|ukraine|russia|taiwan|tariff|sanction|war|missile|strike|centcom|pentagon|hormuz|gaza|ceasefire|negotiat|conflict|military|drone|kyiv)/i;

export function isWarUpdateHeadline(title: string): boolean {
  // War/geo patterns win even inside futures-wrap headlines (Nasdaq + US-Iran war, etc.)
  if (WAR_UPDATE_PATTERNS.some((p) => p.test(title))) return true;

  const priority = classifyHeadline(title);
  if (priority === "critical") return true;
  if (priority === "important" && GEO_IMPORTANT_HINT.test(title)) return true;

  return false;
}

export function isWarUpdateTrumpPost(text: string): boolean {
  if (isJunkHeadline(text)) return false;
  return TRUMP_WAR_PATTERNS.some((p) => p.test(text));
}

/** @deprecated use isWarUpdateHeadline */
export function isGeoTopic(text: string): boolean {
  return isWarUpdateHeadline(text) || isWarUpdateTrumpPost(text);
}

function filterGeoHeadlines(raw: Headline[], limit = 10): GeoHeadline[] {
  const sorted = raw
    .filter((h) => isWarUpdateHeadline(h.title))
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
    .map(({ title, link, publishedAt }) => ({ title, link, publishedAt }));

  return dedupeByStory(sorted, limit);
}

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "on",
  "in",
  "at",
  "to",
  "for",
  "of",
  "and",
  "or",
  "as",
  "is",
  "was",
  "were",
  "this",
  "that",
  "with",
  "from",
  "by",
  "over",
  "into",
  "its",
  "are",
  "be",
  "has",
  "had",
  "not",
  "no",
  "us",
  "says",
  "said",
]);

/** Strip wire prefixes so Centcom/AP clusters dedupe cleanly. */
function normalizeStoryText(text: string): string {
  return text
    .toLowerCase()
    .replace(/^financialjuice:\s*/i, "")
    .replace(/^breaking:\s*/i, "")
    .replace(/^us centcom:\s*/i, "")
    .replace(/^centcom:\s*/i, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function storyTokens(text: string): Set<string> {
  return new Set(
    normalizeStoryText(text)
      .split(" ")
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

export function isDuplicateStory(a: string, b: string): boolean {
  const na = normalizeStoryText(a);
  const nb = normalizeStoryText(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const ta = storyTokens(a);
  const tb = storyTokens(b);
  if (jaccardSimilarity(ta, tb) >= 0.4) return true;

  // Same-source burst: e.g. multiple Centcom/Iran strike updates within one event
  const shared = [...ta].filter((t) => tb.has(t));
  if (shared.length >= 4 && jaccardSimilarity(ta, tb) >= 0.28) return true;

  return false;
}

function dedupeByStory<T extends { title: string }>(
  items: T[],
  limit: number
): T[] {
  const kept: T[] = [];
  for (const item of items) {
    if (kept.some((k) => isDuplicateStory(item.title, k.title))) continue;
    kept.push(item);
    if (kept.length >= limit) break;
  }
  return kept;
}

function dedupeNewsItems(items: MarketNewsItem[], limit: number): MarketNewsItem[] {
  const kept: MarketNewsItem[] = [];
  for (const item of items) {
    if (kept.some((k) => isDuplicateStory(item.text, k.text))) continue;
    kept.push(item);
    if (kept.length >= limit) break;
  }
  return kept;
}

/** War + Trump headlines that can move NQ / ES / Gold — newest first, deduped. */
export function buildMarketNewsFeed(
  sources: GeopoliticsSources,
  limit = 8
): MarketNewsItem[] {
  const headlineItems: MarketNewsItem[] = sources.headlines.map((h) => ({
    id: `h:${h.link || h.title}`,
    kind: "headline" as const,
    text: truncate(h.title, 130),
    link: h.link,
    publishedAt: h.publishedAt,
  }));

  const trumpItems: MarketNewsItem[] = sources.trumpGeoPosts.map((p) => ({
    id: `t:${p.id}`,
    kind: "trump" as const,
    text: truncate(p.text, 130),
    link: p.url || null,
    publishedAt: p.publishedAt,
  }));

  const merged = [...headlineItems, ...trumpItems].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return dedupeNewsItems(merged, limit);
}

export function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

export async function gatherGeopoliticsSources(): Promise<GeopoliticsSources> {
  const [{ raw }, trumpPosts] = await Promise.all([
    fetchHeadlinesMeta(),
    fetchRecentTrumpPosts(10),
  ]);

  const headlines = filterGeoHeadlines(raw);
  const trumpGeoPosts = trumpPosts.filter((p) => isWarUpdateTrumpPost(p.text));

  return { headlines, trumpPosts, trumpGeoPosts };
}
