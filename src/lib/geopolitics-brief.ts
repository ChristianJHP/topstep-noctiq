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
- war: max 14 words — punchy headline-style, latest conflict fact only. No filler, no second clause with "as/citing/while".
- trump: max 10 words — Trump's latest war/tariffs post, or empty string if none.
- expect: max 12 words — one thing to watch in next 24h. No lists.
- markets: max 18 words — NQ/ES/gold risk tone only.
- Telegraph style. No stock roundups. No trade calls. Plain text.`;
}

function clampBriefField(text: string, maxWords: number, maxChars: number): string {
  let t = text.replace(/\s+/g, " ").trim();
  const words = t.split(" ").filter(Boolean);
  if (words.length > maxWords) {
    t = `${words.slice(0, maxWords).join(" ")}…`;
  }
  return truncate(t, maxChars);
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

    const war = clampBriefField(parsed.war?.trim() ?? "", 14, 95);
    const expect = clampBriefField(parsed.expect?.trim() ?? "", 12, 85);
    const markets = clampBriefField(parsed.markets?.trim() ?? "", 18, 120);
    if (!war || !expect || !markets) return null;

    const trumpRaw = parsed.trump?.replace(/\s+/g, " ").trim();
    const trump =
      trumpRaw && trumpRaw.length > 3
        ? clampBriefField(trumpRaw, 10, 75)
        : null;

    return { war, trump, expect, markets };
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
    ? truncate(headline.title, 85)
    : "No war headlines in feed right now.";

  const trumpPost = sources.trumpGeoPosts[0] ?? null;
  const trump = trumpPost ? truncate(trumpPost.text, 70) : null;

  const expect = headline
    ? "Watch for retaliation or Hormuz spillover in next 24h."
    : "Quiet on geo — trade levels unless breaking news hits.";

  const riskOff = riskOffHint(
    `${headline?.title ?? ""} ${trumpPost?.text ?? ""}`
  );
  const markets = riskOff
    ? "Escalation headlines → risk-off NQ/ES, oil/gold bid possible on gaps."
    : "Low geo noise — trade structure unless a new strike or sanction hits wire.";

  return { war, trump, expect, markets };
}

function attachFeed(
  brief: GeopoliticsBriefCore,
  sources: GeopoliticsSources
): Omit<GeopoliticsBriefPayload, "generatedAt" | "configured" | "revalidateSec"> {
  return { ...brief, feed: buildMarketNewsFeed(sources) };
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
    return { ...fallback, ...base };
  }

  const model = getBiasSummaryModel();
  if (!model) {
    return { ...fallback, ...base };
  }

  try {
    const { text } = await generateText({
      model,
      prompt: buildPrompt(sources),
      maxOutputTokens: 220,
    });

    const parsed = parseBrief(text);
    return parsed
      ? { ...attachFeed(parsed, sources), ...base }
      : { ...fallback, ...base };
  } catch (error) {
    console.error("[geopolitics-brief] AI failed, using fallback", error);
    return { ...fallback, ...base };
  }
}

const getCachedGeoBriefOpen = unstable_cache(
  generateGeopoliticsBrief,
  ["geopolitics-brief-v4-open"],
  { revalidate: GEO_BRIEF_REVALIDATE_SEC, tags: ["geopolitics-brief"] }
);

const getCachedGeoBriefClosed = unstable_cache(
  generateGeopoliticsBrief,
  ["geopolitics-brief-v4-closed"],
  { revalidate: GEO_BRIEF_CLOSED_REVALIDATE_SEC, tags: ["geopolitics-brief"] }
);

export async function getCachedGeopoliticsBrief(): Promise<GeopoliticsBriefPayload> {
  return isFuturesSessionOpen()
    ? getCachedGeoBriefOpen()
    : getCachedGeoBriefClosed();
}
