import { unstable_cache } from "next/cache";
import { generateText } from "ai";
import { getBiasSummaryModel, isAiGatewayConfigured } from "@/lib/ai-gateway";
import { BIAS_SUMMARY_REVALIDATE_SEC } from "@/lib/bias-summary-config";
import { fetchCalendarMeta, pickNextHighImpact } from "@/lib/events";
import { fetchHeadlinesMeta } from "@/lib/headlines";
import type { MarketContext } from "@/lib/htf-status";
import { computeMarketContext } from "@/lib/htf-status";

export type BiasSummaryPayload = {
  summary: string | null;
  generatedAt?: string;
  configured?: boolean;
};

function fmtSymbol(s: MarketContext["nq"]) {
  return `${s.label} ${s.current} | 4H ${s.fourHour.colorLabel} | 1H ${s.oneHour.colorLabel} | ${s.expansion} | 4H H ${s.h4High} L ${s.h4Low} (${s.distances.toH4High}pt from 4H high)`;
}

function buildPrompt(
  markets: MarketContext,
  nextEvent: ReturnType<typeof pickNextHighImpact>,
  headlines: string[]
) {
  const lines = [
    "NQ & ES futures context (America/New_York):",
    fmtSymbol(markets.nq),
    fmtSymbol(markets.es),
    `Relative strength: ${markets.relativeStrength.headline}`,
  ];

  if (markets.smt) {
    lines.push(`SMT: ${markets.smt.message}`);
  }

  if (nextEvent) {
    lines.push(
      `Next macro: ${nextEvent.title} at ${nextEvent.dayEt} ${nextEvent.timeEt} ET`
    );
  } else {
    lines.push("Next macro: none on calendar this week");
  }

  if (headlines.length) {
    lines.push("Headlines:");
    headlines.slice(0, 5).forEach((h) => lines.push(`- ${h}`));
  }

  return `You are a futures analyst. Reason through the data below before writing your read.

${lines.join("\n")}

Write exactly 2 short sentences (max 55 words total).
Sentence 1: current 4H/1H structure and which index is relatively stronger — cite specific levels or expansion state from the data.
Sentence 2: what matters for RTH (key level, range position, or next macro event if relevant).

Rules:
- Plain text only. No markdown, bullets, or labels.
- Only use numbers and facts from the data above. Do not invent levels or news.
- Sound like a trader talking to another trader, not marketing copy.
- Do not say "bias board", "actionable", "navigate", or "landscape".`;
}

async function generateBiasSummary(): Promise<BiasSummaryPayload> {
  if (!isAiGatewayConfigured()) {
    return { summary: null, configured: false };
  }

  const model = getBiasSummaryModel();
  if (!model) {
    return { summary: null, configured: false };
  }

  const [markets, cal, headlinesPayload] = await Promise.all([
    computeMarketContext(),
    fetchCalendarMeta(),
    fetchHeadlinesMeta(),
  ]);

  const nextEvent = pickNextHighImpact(cal.events);
  const headlines = headlinesPayload.marketMoving.map((h) => h.title);

  const { text } = await generateText({
    model,
    prompt: buildPrompt(markets, nextEvent, headlines),
    maxOutputTokens: 160,
  });

  const summary = text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();

  return {
    summary,
    generatedAt: new Date().toISOString(),
    configured: true,
  };
}

export const getCachedBiasSummary = unstable_cache(
  generateBiasSummary,
  ["bias-ai-summary"],
  {
    revalidate: BIAS_SUMMARY_REVALIDATE_SEC,
    tags: ["bias-summary"],
  }
);

export { BIAS_SUMMARY_REVALIDATE_SEC } from "@/lib/bias-summary-config";
