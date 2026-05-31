import { unstable_cache } from "next/cache";
import { generateText } from "ai";
import { getBiasSummaryModel, isAiGatewayConfigured } from "@/lib/ai-gateway";
import {
  buildBiasSummaryMarketContext,
  type BiasSummaryMarketContext,
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

Return ONLY valid JSON with exactly these five keys:
{
  "context": "",
  "location": "",
  "relativeStrength": "",
  "watch": "",
  "catalyst": ""
}

Row rules (one short sentence each, plain text):
- context: NQ and ES price plus 4H/1H candle colors from JSON only.
- location: range position % and distance to 4H/1H highs/lows from JSON only.
- relativeStrength: use relativeStrength fields only.
- watch: use smt.message if present; otherwise cite nearest 4H/1H levels from JSON distances.
- catalyst: use nextRedFolderEvent only.

Hard rules:
- Do NOT analyze charts or images. Do NOT predict direction or bias.
- Do NOT invent prices, levels, events, or headlines.
- If a JSON field is null or missing for a row, write "insufficient data" for that part.
- If nextRedFolderEvent is null, catalyst must say no red-folder event is scheduled.
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

function fmtInterval(label: string, snap: BiasSummaryMarketContext["nq"]) {
  const h4 = snap.fourHour;
  const h1 = snap.oneHour;
  if (snap.price == null) return `${label}: insufficient data`;

  const h4Color = h4.candleColor ?? "insufficient data";
  const h1Color = h1.candleColor ?? "insufficient data";
  return `${label} ${snap.price}, 4H ${h4Color}, 1H ${h1Color}`;
}

function fmtLocation(label: string, snap: BiasSummaryMarketContext["nq"]) {
  const h4 = snap.fourHour;
  const h1 = snap.oneHour;
  if (snap.price == null) return `${label}: insufficient data`;

  const parts: string[] = [];
  if (h4.pctInRange != null) {
    parts.push(
      `4H ${h4.pctInRange}% of range (${h4.distToHighPts ?? "?"}pt below 4H high ${h4.high ?? "?"}, ${h4.distToLowPts ?? "?"}pt above 4H low ${h4.low ?? "?"})`
    );
  } else {
    parts.push("4H insufficient data");
  }
  if (h1.pctInRange != null) {
    parts.push(
      `1H ${h1.pctInRange}% of range (${h1.distToHighPts ?? "?"}pt below 1H high ${h1.high ?? "?"}, ${h1.distToLowPts ?? "?"}pt above 1H low ${h1.low ?? "?"})`
    );
  } else {
    parts.push("1H insufficient data");
  }
  return `${label}: ${parts.join("; ")}`;
}

export function formatRowsDeterministic(
  ctx: BiasSummaryMarketContext
): BiasSummaryRows {
  const rs = ctx.relativeStrength;
  let relativeStrength = "insufficient data";
  if (rs.headline && rs.stronger) {
    relativeStrength = `${rs.headline} (${rs.stronger}; NQ ${rs.nqPtsFromH4High ?? "?"}pt from 4H high, ES ${rs.esPtsFromH4High ?? "?"}pt from 4H high)`;
  }

  let watch = "insufficient data";
  if (ctx.smt.message) {
    watch = ctx.smt.message;
  } else {
    watch = `NQ 4H high ${ctx.nq.fourHour.high ?? "?"} / low ${ctx.nq.fourHour.low ?? "?"}; ES 4H high ${ctx.es.fourHour.high ?? "?"} / low ${ctx.es.fourHour.low ?? "?"}`;
  }

  let catalyst = "No red-folder event scheduled.";
  if (ctx.nextRedFolderEvent) {
    const e = ctx.nextRedFolderEvent;
    catalyst = `${e.title} — ${e.dayEt} ${e.timeEt} ET`;
  }

  return {
    context: `${fmtInterval("NQ", ctx.nq)}; ${fmtInterval("ES", ctx.es)}.`,
    location: `${fmtLocation("NQ", ctx.nq)}; ${fmtLocation("ES", ctx.es)}.`,
    relativeStrength,
    watch,
    catalyst,
  };
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

  try {
    const { text } = await generateText({
      model,
      prompt: buildPrompt(marketContext),
      maxOutputTokens: 400,
    });

    const rows = parseRows(text) ?? formatRowsDeterministic(marketContext);

    return {
      rows,
      generatedAt: new Date().toISOString(),
      configured: true,
    };
  } catch (error) {
    console.error("[bias/summary] AI format failed, using deterministic rows", error);
    return {
      rows: formatRowsDeterministic(marketContext),
      generatedAt: new Date().toISOString(),
      configured: true,
    };
  }
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
