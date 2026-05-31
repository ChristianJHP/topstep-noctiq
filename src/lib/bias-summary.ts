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

export type BiasSummaryRows = {
  context: string;
  location: string;
  relativeStrength: string;
  watch: string;
  catalyst: string;
};

export type BiasSummaryPayload = {
  rows: BiasSummaryRows | null;
  generatedAt?: string;
  configured?: boolean;
};

const ROW_KEYS = [
  "context",
  "location",
  "relativeStrength",
  "watch",
  "catalyst",
] as const;

function buildPrompt(marketContext: BiasSummaryMarketContext): string {
  return `You format a futures market read from structured JSON only.

INPUT JSON:
${JSON.stringify(marketContext)}

Return ONLY valid JSON:
{
  "context": "",
  "location": "",
  "relativeStrength": "",
  "watch": "",
  "catalyst": ""
}

Each row is ONE short sentence (max 18 words). Each row must contain ONLY its assigned facts — never repeat information from another row.

- context: NQ and ES last price plus 4H/1H candle colors. No levels, no distances, no events.
- location: range position % and distance to the nearest 4H/1H boundary per symbol. No prices, no colors, no relative-strength comparison.
- relativeStrength: stronger index and headline label only. No prices, levels, distances, or SMT.
- watch: smt.message only. If smt.message is null, write exactly: "No SMT divergence."
- catalyst: nextRedFolderEvent title and time only. If null, write exactly: "No red-folder event scheduled."

Hard rules:
- Do NOT analyze charts. Do NOT predict direction.
- Do NOT invent data. Use "insufficient data" only when the JSON field needed for that row is null.
- No markdown. No extra keys.`;
}

function parseRows(text: string): BiasSummaryRows | null {
  try {
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed = JSON.parse(cleaned) as Partial<BiasSummaryRows>;
    if (!ROW_KEYS.every((k) => typeof parsed[k] === "string")) return null;
    return {
      context: parsed.context!.trim(),
      location: parsed.location!.trim(),
      relativeStrength: parsed.relativeStrength!.trim(),
      watch: parsed.watch!.trim(),
      catalyst: parsed.catalyst!.trim(),
    };
  } catch {
    return null;
  }
}

function fmtColors(snap: SymbolSnapshot): string {
  if (snap.price == null) return "insufficient data";
  const h4 = snap.fourHour.candleColor ?? "?";
  const h1 = snap.oneHour.candleColor ?? "?";
  return `${snap.price} (4H ${h4}, 1H ${h1})`;
}

function nearestBoundary(interval: IntervalSnapshot, tf: string): string | null {
  const { pctInRange, distToHighPts, distToLowPts, high, low } = interval;
  if (pctInRange == null || distToHighPts == null || distToLowPts == null) {
    return null;
  }

  if (distToHighPts <= distToLowPts) {
    return `${tf} ${pctInRange}% range, ${distToHighPts}pt to H ${high ?? "?"}`;
  }
  return `${tf} ${pctInRange}% range, ${distToLowPts}pt to L ${low ?? "?"}`;
}

function fmtLocationSymbol(label: string, snap: SymbolSnapshot): string {
  if (snap.price == null) return `${label}: insufficient data`;

  const h4 = nearestBoundary(snap.fourHour, "4H");
  const h1 = nearestBoundary(snap.oneHour, "1H");
  const parts = [h4, h1].filter(Boolean);

  return parts.length
    ? `${label} ${parts.join(", ")}`
    : `${label}: insufficient data`;
}

export function formatRowsDeterministic(
  ctx: BiasSummaryMarketContext
): BiasSummaryRows {
  const rs = ctx.relativeStrength;

  let relativeStrength = "insufficient data";
  if (rs.headline) {
    relativeStrength =
      rs.stronger && rs.stronger !== "neutral"
        ? `${rs.headline} — ${rs.stronger} ahead`
        : rs.headline;
  }

  const watch = ctx.smt.message ?? "No SMT divergence.";

  let catalyst = "No red-folder event scheduled.";
  if (ctx.nextRedFolderEvent) {
    const e = ctx.nextRedFolderEvent;
    catalyst = `${e.title}, ${e.dayEt} ${e.timeEt} ET`;
  }

  return {
    context: `NQ ${fmtColors(ctx.nq)} · ES ${fmtColors(ctx.es)}`,
    location: `${fmtLocationSymbol("NQ", ctx.nq)} · ${fmtLocationSymbol("ES", ctx.es)}`,
    relativeStrength,
    watch,
    catalyst,
  };
}

function rowsLookRedundant(rows: BiasSummaryRows): boolean {
  const values = ROW_KEYS.map((k) => rows[k].toLowerCase());
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      if (values[i] === values[j]) return true;
      if (values[i].length > 20 && values[j].includes(values[i].slice(0, 20))) {
        return true;
      }
    }
  }
  return false;
}

async function generateBiasSummary(): Promise<BiasSummaryPayload> {
  if (!isAiGatewayConfigured()) {
    return { rows: null, configured: false };
  }

  const model = getBiasSummaryModel();
  if (!model) {
    return { rows: null, configured: false };
  }

  const marketContext = await buildBiasSummaryMarketContext();
  const fallback = formatRowsDeterministic(marketContext);

  try {
    const { text } = await generateText({
      model,
      prompt: buildPrompt(marketContext),
      maxOutputTokens: 320,
    });

    const parsed = parseRows(text);
    const rows =
      parsed && !rowsLookRedundant(parsed) ? parsed : fallback;

    return {
      rows,
      generatedAt: new Date().toISOString(),
      configured: true,
    };
  } catch (error) {
    console.error("[bias/summary] AI format failed, using deterministic rows", error);
    return {
      rows: fallback,
      generatedAt: new Date().toISOString(),
      configured: true,
    };
  }
}

export const getCachedBiasSummary = unstable_cache(
  generateBiasSummary,
  ["bias-ai-summary-v2"],
  {
    revalidate: BIAS_SUMMARY_REVALIDATE_SEC,
    tags: ["bias-summary"],
  }
);

export { BIAS_SUMMARY_REVALIDATE_SEC } from "@/lib/bias-summary-config";
