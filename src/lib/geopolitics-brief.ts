import { unstable_cache } from "next/cache";
import { generateText } from "ai";
import { getBiasSummaryModel, isAiGatewayConfigured } from "@/lib/ai-gateway";
import { isFuturesSessionOpen } from "@/lib/futures-session";
import {
  buildMarketNewsFeed,
  gatherGeopoliticsSources,
  truncate,
  type GeopoliticsSources,
  type MarketNewsItem,
} from "@/lib/geopolitics-sources";
import { classifyHeadline } from "@/lib/headline-classifier";

export const GEO_BRIEF_REVALIDATE_SEC = 3 * 60;
export const GEO_BRIEF_CLOSED_REVALIDATE_SEC = 10 * 60;

export type GeoBriefField = {
  text: string;
  link: string | null;
};

export type GeopoliticsBriefPayload = {
  war: GeoBriefField;
  trump: GeoBriefField | null;
  expect: GeoBriefField;
  markets: string;
  feed: MarketNewsItem[];
  generatedAt: string;
  configured: boolean;
  revalidateSec: number;
};

type GeopoliticsBriefStrings = {
  war: string;
  trump: string | null;
  expect: string;
  markets: string;
};

type GeopoliticsBriefCore = Omit<
  GeopoliticsBriefPayload,
  "generatedAt" | "configured" | "revalidateSec" | "feed"
>;

function buildPrompt(sources: GeopoliticsSources): string {
  return `You write a tight market-news brief for NQ/ES/Gold futures traders.

LIVE HEADLINES (newest first):
${sources.headlines.map((h) => `- ${h.title}`).join("\n") || "- none"}

TRUMP TRUTH SOCIAL (newest first):
${
  sources.trumpPosts
    .slice(0, 6)
    .map((p) => `- [${p.publishedAt}] ${p.text}`)
    .join("\n") || "- none fetched"
}

Return ONLY valid JSON:
{"war":"","trump":"","expect":"","markets":""}

Rules:
- war: ONE short sentence, max 10 words — the single headline that matters most for NQ right now. If nothing is market-moving, say "Quiet tape — no headline risk."
- trump: max 8 words — or empty string if none relevant.
- expect: max 10 words — what to watch next 24h from the feed.
- markets: max 16 words — NQ/ES/gold risk tone from the headlines (risk-on/off, geo, macro).
- Skip stock-picker fluff. Telegraph style. No trade calls. Plain text.`;
}

/** Cut filler clauses and enforce hard length — never show wire essay text. */
export function firstShortClause(
  text: string,
  maxWords: number,
  maxChars: number
): string {
  let t = text.replace(/\s+/g, " ").trim();
  if (!t) return t;

  t = t.split(/\s*,?\s+(as|citing|while|after|because|following|amid|whereas)\s+/i)[0] ?? t;
  t = (t.split(/[;,]/)[0] ?? t).trim();

  const words = t.split(" ").filter(Boolean);
  if (words.length > maxWords) {
    t = `${words.slice(0, maxWords).join(" ")}…`;
  }
  return truncate(t, maxChars);
}

function clampBriefField(text: string, maxWords: number, maxChars: number): string {
  return firstShortClause(text, maxWords, maxChars);
}

export function sanitizeGeoBrief(
  brief: GeopoliticsBriefStrings
): GeopoliticsBriefStrings {
  const trumpRaw = brief.trump?.replace(/\s+/g, " ").trim();
  return {
    war: firstShortClause(brief.war, 10, 62),
    trump:
      trumpRaw && trumpRaw.length > 3
        ? firstShortClause(trumpRaw, 8, 52)
        : null,
    expect: firstShortClause(brief.expect, 10, 58),
    markets: firstShortClause(brief.markets, 16, 95),
  };
}

export function attachSourceLinks(
  brief: GeopoliticsBriefStrings,
  sources: GeopoliticsSources
): GeopoliticsBriefCore {
  const sanitized = sanitizeGeoBrief(brief);
  const warHeadline = sources.headlines[0];
  const expectHeadline = sources.headlines[1] ?? warHeadline;
  const trumpPost = sources.trumpPosts[0] ?? null;

  return {
    war: {
      text: sanitized.war,
      link: warHeadline?.link || null,
    },
    trump: sanitized.trump
      ? {
          text: sanitized.trump,
          link: trumpPost?.url || null,
        }
      : null,
    expect: {
      text: sanitized.expect,
      link: expectHeadline?.link || warHeadline?.link || null,
    },
    markets: sanitized.markets,
  };
}

function parseBrief(text: string): GeopoliticsBriefStrings | null {
  try {
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed = JSON.parse(cleaned) as {
      war?: string;
      trump?: string;
      expect?: string;
      markets?: string;
    };

    const war = clampBriefField(parsed.war?.trim() ?? "", 10, 62);
    const expect = clampBriefField(parsed.expect?.trim() ?? "", 10, 58);
    const markets = clampBriefField(parsed.markets?.trim() ?? "", 16, 95);
    if (!war || !expect || !markets) return null;

    const trumpRaw = parsed.trump?.replace(/\s+/g, " ").trim();
    const trump =
      trumpRaw && trumpRaw.length > 3
        ? clampBriefField(trumpRaw, 8, 52)
        : null;

    return sanitizeGeoBrief({ war, trump, expect, markets });
  } catch {
    return null;
  }
}

function riskOffHint(text: string): boolean {
  return /(attack|strike|missile|war|sanction|escalat|iran|russia|ukraine|oil surge|crude|houthi|conflict)/i.test(
    text
  );
}

function isPlaceholderWar(text: string): boolean {
  return /no war headlines|no live headlines|feed unavailable|quiet tape/i.test(
    text
  );
}

function isPlaceholderExpect(text: string): boolean {
  return /quiet on geo|feed quiet|unless breaking news/i.test(text);
}

export function formatGeopoliticsDeterministic(
  sources: GeopoliticsSources
): GeopoliticsBriefStrings {
  const headline = sources.headlines[0];
  const critical =
    sources.headlines.find((h) => classifyHeadline(h.title) === "critical") ??
    headline;

  const war = critical
    ? firstShortClause(critical.title, 10, 62)
    : "Quiet tape — no headline risk.";

  const trumpPost = sources.trumpPosts[0] ?? null;
  const trump = trumpPost
    ? firstShortClause(trumpPost.text, 8, 52)
    : null;

  const expect = critical
    ? classifyHeadline(critical.title) === "critical"
      ? "Watch headline follow-through on NQ next 24h."
      : "Macro noise low — trade levels unless headline breaks."
    : "Feed quiet — structure over news.";

  const riskOff = riskOffHint(
    `${critical?.title ?? ""} ${trumpPost?.text ?? ""}`
  );
  const markets = riskOff
    ? "Headline risk — NQ/ES heavy, gold bid on gaps."
    : "Low headline risk — trade structure and levels.";

  return sanitizeGeoBrief({ war, trump, expect, markets });
}

function attachFeed(
  brief: GeopoliticsBriefStrings,
  sources: GeopoliticsSources
): Omit<GeopoliticsBriefPayload, "generatedAt" | "configured" | "revalidateSec"> {
  return { ...attachSourceLinks(brief, sources), feed: buildMarketNewsFeed(sources) };
}

function finalizeBrief(
  brief: Omit<GeopoliticsBriefPayload, "generatedAt" | "configured" | "revalidateSec">,
  base: Pick<GeopoliticsBriefPayload, "generatedAt" | "configured" | "revalidateSec">
): GeopoliticsBriefPayload {
  const { feed, ...core } = brief;
  const clamped = sanitizeGeoBrief({
    war: core.war.text,
    trump: core.trump?.text ?? null,
    expect: core.expect.text,
    markets: core.markets,
  });
  return {
    war: { text: clamped.war, link: core.war.link },
    trump:
      core.trump && clamped.trump
        ? { text: clamped.trump, link: core.trump.link }
        : null,
    expect: { text: clamped.expect, link: core.expect.link },
    markets: clamped.markets,
    feed,
    ...base,
  };
}

async function generateGeopoliticsBrief(): Promise<GeopoliticsBriefPayload> {
  const sources = await gatherGeopoliticsSources();
  const fallback = attachFeed(formatGeopoliticsDeterministic(sources), sources);
  const generatedAt = new Date().toISOString();
  const revalidateSec = isFuturesSessionOpen()
    ? GEO_BRIEF_REVALIDATE_SEC
    : GEO_BRIEF_CLOSED_REVALIDATE_SEC;
  const base = {
    generatedAt,
    configured: isAiGatewayConfigured(),
    revalidateSec,
  };

  if (!isAiGatewayConfigured()) {
    return finalizeBrief(fallback, base);
  }

  const model = getBiasSummaryModel();
  if (!model) {
    return finalizeBrief(fallback, base);
  }

  try {
    const { text } = await generateText({
      model,
      prompt: buildPrompt(sources),
      maxOutputTokens: 120,
    });

    const parsed = parseBrief(text);
    const brief = parsed
      ? attachFeed(parsed, sources)
      : fallback;
    return finalizeBrief(brief, base);
  } catch (error) {
    console.error("[geopolitics-brief] AI failed, using fallback", error);
    return finalizeBrief(fallback, base);
  }
}

const getCachedGeoBriefOpen = unstable_cache(
  generateGeopoliticsBrief,
  ["geopolitics-brief-v8-open"],
  { revalidate: GEO_BRIEF_REVALIDATE_SEC, tags: ["geopolitics-brief"] }
);

const getCachedGeoBriefClosed = unstable_cache(
  generateGeopoliticsBrief,
  ["geopolitics-brief-v8-closed"],
  { revalidate: GEO_BRIEF_CLOSED_REVALIDATE_SEC, tags: ["geopolitics-brief"] }
);

/** Merge cached AI brief with always-fresh live headlines + feed. */
export async function composeGeopoliticsPayload(
  cached: GeopoliticsBriefPayload
): Promise<GeopoliticsBriefPayload> {
  const sources = await gatherGeopoliticsSources();
  const live = attachFeed(formatGeopoliticsDeterministic(sources), sources);
  const aiUsable =
    cached.configured &&
    sources.headlines.length > 0 &&
    !isPlaceholderWar(cached.war.text);

  const strings: GeopoliticsBriefStrings = {
    war: aiUsable ? cached.war.text : live.war.text,
    trump: cached.trump?.text ?? live.trump?.text ?? null,
    expect:
      aiUsable && !isPlaceholderExpect(cached.expect.text)
        ? cached.expect.text
        : live.expect.text,
    markets: cached.markets || live.markets,
  };

  return finalizeBrief(
    {
      ...attachSourceLinks(strings, sources),
      feed: live.feed,
    },
    {
      generatedAt: new Date().toISOString(),
      configured: cached.configured,
      revalidateSec: cached.revalidateSec,
    }
  );
}

export async function getCachedGeopoliticsBrief(): Promise<GeopoliticsBriefPayload> {
  return isFuturesSessionOpen()
    ? getCachedGeoBriefOpen()
    : getCachedGeoBriefClosed();
}
