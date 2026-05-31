import { unstable_cache } from "next/cache";
import { generateText } from "ai";
import { getBiasSummaryModel, isAiGatewayConfigured } from "@/lib/ai-gateway";
import { isFuturesSessionOpen } from "@/lib/futures-session";
import {
  gatherGeopoliticsSources,
  truncate,
  type GeopoliticsSources,
} from "@/lib/geopolitics-sources";

export const GEO_BRIEF_REVALIDATE_SEC = 15 * 60;
export const GEO_BRIEF_CLOSED_REVALIDATE_SEC = 45 * 60;

export type GeopoliticsBriefPayload = {
  war: string;
  trump: string | null;
  expect: string;
  markets: string;
  generatedAt: string;
  configured: boolean;
  revalidateSec: number;
};

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
- war: ONE sentence — latest war/conflict/negotiation context from headlines only. NO stock market or earnings angles.
- trump: ONE short sentence on Trump's latest war/tariffs/negotiation post — empty string if nothing relevant.
- expect: ONE sentence — what to watch next on negotiations, strikes, sanctions, or ceasefire talks (next 24h).
- markets: ONE sentence, max 22 words — how this may affect NQ, ES, oil, or gold (gap risk, vol, safe haven, etc.).
- Ignore stock roundup headlines (Dow Jones, Nvidia, buy points, etc.). Use ONLY source facts. No hype. No trade calls. Plain text.`;
}

function parseBrief(text: string): Omit<
  GeopoliticsBriefPayload,
  "generatedAt" | "configured" | "revalidateSec"
> | null {
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

    const war = parsed.war?.replace(/\s+/g, " ").trim();
    const expect = parsed.expect?.replace(/\s+/g, " ").trim();
    const markets = parsed.markets?.replace(/\s+/g, " ").trim();
    if (!war || !expect || !markets) return null;

    const trumpRaw = parsed.trump?.replace(/\s+/g, " ").trim();
    const trump = trumpRaw && trumpRaw.length > 3 ? trumpRaw : null;

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
): Omit<
  GeopoliticsBriefPayload,
  "generatedAt" | "configured" | "revalidateSec"
> {
  const headline = sources.headlines[0];
  const war = headline
    ? truncate(headline.title, 140)
    : "No war or negotiation headline in feed — check back after the next diplomatic update.";

  const trumpPost = sources.trumpGeoPosts[0] ?? null;
  const trump = trumpPost ? truncate(trumpPost.text, 120) : null;

  const expect = headline
    ? "Watch for negotiation headlines, sanction news, or military escalation before the next session."
    : "Quiet on war talks — normal rules unless breaking conflict news hits.";

  const riskOff = riskOffHint(
    `${headline?.title ?? ""} ${trumpPost?.text ?? ""}`
  );
  const markets = riskOff
    ? "Escalation headlines → risk-off NQ/ES, oil/gold bid possible on gaps."
    : "Low geo noise — trade structure unless a new strike or sanction hits wire.";

  return { war, trump, expect, markets };
}

async function generateGeopoliticsBrief(): Promise<GeopoliticsBriefPayload> {
  const sources = await gatherGeopoliticsSources();
  const fallback = formatGeopoliticsDeterministic(sources);
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
    return parsed ? { ...parsed, ...base } : { ...fallback, ...base };
  } catch (error) {
    console.error("[geopolitics-brief] AI failed, using fallback", error);
    return { ...fallback, ...base };
  }
}

const getCachedGeoBriefOpen = unstable_cache(
  generateGeopoliticsBrief,
  ["geopolitics-brief-v2-open"],
  { revalidate: GEO_BRIEF_REVALIDATE_SEC, tags: ["geopolitics-brief"] }
);

const getCachedGeoBriefClosed = unstable_cache(
  generateGeopoliticsBrief,
  ["geopolitics-brief-v2-closed"],
  { revalidate: GEO_BRIEF_CLOSED_REVALIDATE_SEC, tags: ["geopolitics-brief"] }
);

export async function getCachedGeopoliticsBrief(): Promise<GeopoliticsBriefPayload> {
  return isFuturesSessionOpen()
    ? getCachedGeoBriefOpen()
    : getCachedGeoBriefClosed();
}
