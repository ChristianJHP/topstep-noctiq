import { unstable_cache } from "next/cache";
import { generateText } from "ai";
import { getBiasSummaryModel, isAiGatewayConfigured } from "@/lib/ai-gateway";
import {
  buildBiasSummaryMarketContext,
  type BiasSummaryMarketContext,
  type IntervalSnapshot,
  type SymbolSnapshot,
} from "@/lib/bias-summary-context";
import { BIAS_SUMMARY_REVALIDATE_SEC } from "@/lib/bias-summary-config";

export type BiasSummaryPayload = {
  line: string | null;
  generatedAt?: string;
  configured?: boolean;
};

function buildPrompt(ctx: BiasSummaryMarketContext): string {
  return `You write ONE sentence on NQ/ES for the next hour.

INPUT JSON:
${JSON.stringify(ctx)}

Return ONLY valid JSON: {"line": ""}

The sentence must:
- State current 1H/4H color and where price sits vs the nearest 1H or 4H level (from JSON).
- Mention ES vs NQ strength if not balanced.
- Note 1H candle close in minutesTo1HClose if relevant.
- Note nextRedFolderEvent timing if within 6 hours (minutesUntil).
- Give a brief next-hour lean (grind, chop, test high/low, vol into event) — speculative, not certain.

Rules:
- Exactly ONE sentence, max 40 words. Plain text.
- Use ONLY JSON facts. No chart analysis. Do not invent levels.
- If data missing, say "insufficient data" for that part only.`;
}

function parseLine(text: string): string | null {
  try {
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed = JSON.parse(cleaned) as { line?: string };
    if (typeof parsed.line !== "string" || !parsed.line.trim()) return null;
    return parsed.line.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  } catch {
    const fallback = text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
    return fallback.length > 10 && fallback.length < 280 ? fallback : null;
  }
}

function nearestTarget(interval: IntervalSnapshot): string | null {
  const { distToHighPts, distToLowPts, high, low, candleColor } = interval;
  if (distToHighPts == null || distToLowPts == null) return null;

  if (distToHighPts <= distToLowPts) {
    return `${distToHighPts}pt from ${candleColor ?? "?"} candle high ${high ?? "?"}`;
  }
  return `${distToLowPts}pt from ${candleColor ?? "?"} candle low ${low ?? "?"}`;
}

function symbolTone(snap: SymbolSnapshot): string {
  const h1 = snap.oneHour.candleColor ?? "?";
  const h4 = snap.fourHour.candleColor ?? "?";
  const near = nearestTarget(snap.oneHour) ?? nearestTarget(snap.fourHour);
  return near ? `1H ${h1}, 4H ${h4}, ${near}` : `1H ${h1}, 4H ${h4}`;
}

export function formatLineDeterministic(ctx: BiasSummaryMarketContext): string {
  const rs = ctx.relativeStrength.headline ?? "Balanced";
  const nq = symbolTone(ctx.nq);
  const es = symbolTone(ctx.es);

  let lean = "next hour may chop inside the current 1H range";
  const nq1h = ctx.nq.oneHour;
  if (nq1h.distToHighPts != null && nq1h.distToLowPts != null) {
    if (nq1h.distToHighPts <= nq1h.distToLowPts && nq1h.distToHighPts < 20) {
      lean = "next hour may test the 1H high if momentum holds";
    } else if (nq1h.distToLowPts < 20) {
      lean = "next hour may drift toward the 1H low";
    }
  }

  let timing = "";
  if (ctx.minutesTo1HClose != null) {
    timing = `, ${ctx.minutesTo1HClose}m to 1H close`;
  }
  const event = ctx.nextRedFolderEvent;
  if (event?.minutesUntil != null && event.minutesUntil <= 360) {
    timing += `, ${event.title} in ${event.minutesUntil}m`;
  }

  return `NQ ${nq}; ES ${es}; ${rs}${timing} — ${lean}.`;
}

async function generateBiasSummary(): Promise<BiasSummaryPayload> {
  const ctx = await buildBiasSummaryMarketContext();
  const fallback = formatLineDeterministic(ctx);
  const generatedAt = new Date().toISOString();

  if (!isAiGatewayConfigured()) {
    return { line: fallback, generatedAt, configured: true };
  }

  const model = getBiasSummaryModel();
  if (!model) {
    return { line: fallback, generatedAt, configured: true };
  }

  try {
    const { text } = await generateText({
      model,
      prompt: buildPrompt(ctx),
      maxOutputTokens: 120,
    });

    const line = parseLine(text) ?? fallback;

    return { line, generatedAt, configured: true };
  } catch (error) {
    console.error("[bias/summary] failed, using deterministic line", error);
    return { line: fallback, generatedAt, configured: true };
  }
}

export const getCachedBiasSummary = unstable_cache(
  generateBiasSummary,
  ["bias-ai-summary-v4"],
  {
    revalidate: BIAS_SUMMARY_REVALIDATE_SEC,
    tags: ["bias-summary"],
  }
);

export { BIAS_SUMMARY_REVALIDATE_SEC } from "@/lib/bias-summary-config";
