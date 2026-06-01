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

export const GEO_BRIEF_REVALIDATE_SEC = 15 * 60;
export const GEO_BRIEF_CLOSED_REVALIDATE_SEC = 45 * 60;

export type GeopoliticsBriefPayload = {
  war: string;
  trump: string | null;
  expect: string;
  markets: string;
  feed: MarketNewsItem[];
  generatedAt: string;
  configured: boolean;
  revalidateSec: number;
};

type GeopoliticsBriefCore = Omit<
  GeopoliticsBriefPayload,
  "generatedAt" | "configured" | "revalidateSec" | "feed"
>;

function buildPrompt(sources: GeopoliticsSources): string {
  return `You write a tight geopolitical brief for NQ/ES/Gold futures traders.

HEADLINES (newest first):
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
- war: ONE short sentence, max 10 words. Example: "US struck Iranian radar sites after drone downed." NEVER paste a full headline.
- trump: max 8 words — or empty string if none.
- expect: max 10 words — one watch item for next 24h.
- markets: max 16 words — NQ/ES/gold risk tone only.
- Telegraph style. No stock roundups. No trade calls. Plain text.`;
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

export function sanitizeGeoBrief(brief: GeopoliticsBriefCore): GeopoliticsBriefCore {
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

function parseBrief(text: string): GeopoliticsBriefCore | null {
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

export function formatGeopoliticsDeterministic(
  sources: GeopoliticsSources
): GeopoliticsBriefCore {
  const headline = sources.headlines[0];
  const war = headline
    ? firstShortClause(headline.title, 10, 62)
    : "No war headlines right now.";

  const trumpPost = sources.trumpGeoPosts[0] ?? null;
  const trump = trumpPost
    ? firstShortClause(trumpPost.text, 8, 52)
    : null;

  const expect = headline
    ? "Watch Hormuz retaliation or Kuwait spillover next 24h."
    : "Quiet on geo unless breaking news hits.";

  const riskOff = riskOffHint(
    `${headline?.title ?? ""} ${trumpPost?.text ?? ""}`
  );
  const markets = riskOff
    ? "Risk-off tone — NQ/ES heavy, gold bid on gaps."
    : "Low geo noise — trade structure and levels.";

  return sanitizeGeoBrief({ war, trump, expect, markets });
}

function attachFeed(
  brief: GeopoliticsBriefCore,
  sources: GeopoliticsSources
): Omit<GeopoliticsBriefPayload, "generatedAt" | "configured" | "revalidateSec"> {
  return { ...brief, feed: buildMarketNewsFeed(sources) };
}

function finalizeBrief(
  brief: Omit<GeopoliticsBriefPayload, "generatedAt" | "configured" | "revalidateSec">,
  base: Pick<GeopoliticsBriefPayload, "generatedAt" | "configured" | "revalidateSec">
): GeopoliticsBriefPayload {
  const { feed, ...core } = brief;
  const sanitized = sanitizeGeoBrief(core);
  return { ...sanitized, feed, ...base };
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
  ["geopolitics-brief-v5-open"],
  { revalidate: GEO_BRIEF_REVALIDATE_SEC, tags: ["geopolitics-brief"] }
);

const getCachedGeoBriefClosed = unstable_cache(
  generateGeopoliticsBrief,
  ["geopolitics-brief-v5-closed"],
  { revalidate: GEO_BRIEF_CLOSED_REVALIDATE_SEC, tags: ["geopolitics-brief"] }
);

export async function getCachedGeopoliticsBrief(): Promise<GeopoliticsBriefPayload> {
  return isFuturesSessionOpen()
    ? getCachedGeoBriefOpen()
    : getCachedGeoBriefClosed();
}
