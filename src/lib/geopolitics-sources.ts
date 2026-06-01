import { fetchHeadlinesMeta, type Headline } from "@/lib/headlines";
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

export function isWarUpdateHeadline(title: string): boolean {
  if (isJunkHeadline(title)) return false;
  return WAR_UPDATE_PATTERNS.some((p) => p.test(title));
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
  return raw
    .filter((h) => isWarUpdateHeadline(h.title))
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
    .slice(0, limit)
    .map(({ title, link, publishedAt }) => ({ title, link, publishedAt }));
}

/** War + Trump headlines that can move NQ / ES / Gold — newest first. */
export function buildMarketNewsFeed(
  sources: GeopoliticsSources,
  limit = 8
): MarketNewsItem[] {
  const headlineItems: MarketNewsItem[] = sources.headlines.map((h) => ({
    id: `h:${h.link || h.title}`,
    kind: "headline",
    text: h.title,
    link: h.link,
    publishedAt: h.publishedAt,
  }));

  const trumpItems: MarketNewsItem[] = sources.trumpGeoPosts.map((p) => ({
    id: `t:${p.id}`,
    kind: "trump",
    text: truncate(p.text, 220),
    link: p.url || null,
    publishedAt: p.publishedAt,
  }));

  return [...headlineItems, ...trumpItems]
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
    .slice(0, limit);
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
