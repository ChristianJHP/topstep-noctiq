import { unstable_cache } from "next/cache";
import { generateText } from "ai";
import { getBiasSummaryModel, isAiGatewayConfigured } from "@/lib/ai-gateway";
import {
  BIAS_SUMMARY_CLOSED_REVALIDATE_SEC,
  BIAS_SUMMARY_REVALIDATE_SEC,
} from "@/lib/bias-summary-config";
import { computeMarketContext, type SymbolContext } from "@/lib/htf-status";
import { isFuturesSessionOpen } from "@/lib/futures-session";
import type { SymbolLabel } from "@/lib/strategy-prep";
import { getCachedGeopoliticsBrief } from "@/lib/geopolitics-brief";
import { relevantFvgsForChart } from "@/lib/fvg-detect";

export type LevelsBriefPayload = {
  line: string;
  generatedAt: string;
  configured: boolean;
  revalidateSec: number;
};

export type LevelsBriefContext = {
  symbol: string;
  price: number;
  structure: string;
  cisd: number | null;
  levelBelow: number | null;
  levelAbove: number | null;
  levelBelowLabel: string | null;
  levelAboveLabel: string | null;
  newsRiskElevated: boolean;
};

function pickSymbol(
  label: SymbolLabel,
  ctx: Awaited<ReturnType<typeof computeMarketContext>>
): SymbolContext {
  if (label === "ES") return ctx.es;
  if (label === "GC") return ctx.gold;
  return ctx.nq;
}

function geoRiskOff(war: string, trump: string | null): boolean {
  return /(attack|strike|missile|war|sanction|escalat|iran|russia|ukraine|oil surge|crude|houthi|conflict|risk.?off|safe.?haven)/i.test(
    `${war} ${trump ?? ""}`
  );
}

function nearestLevels(symbol: SymbolContext): {
  below: { price: number; label: string } | null;
  above: { price: number; label: string } | null;
} {
  const price = symbol.current;
  const candidates: { price: number; label: string }[] = [];

  if (symbol.analysis.cisd) {
    candidates.push({ price: symbol.analysis.cisd.price, label: "CISD" });
  }

  const fvgs = [
    ...relevantFvgsForChart(symbol.analysis.fvgs4h, price, 2),
    ...relevantFvgsForChart(symbol.analysis.fvgs1h, price, 2),
  ];
  for (const fvg of fvgs) {
    const mid = Math.round((fvg.top + fvg.bottom) / 2);
    candidates.push({
      price: mid,
      label: `${fvg.timeframe} ${fvg.type === "bullish" ? "bull" : "bear"} imbalance`,
    });
  }

  if (symbol.analysis.swingLow) {
    candidates.push({ price: symbol.analysis.swingLow, label: "swing low" });
  }
  if (symbol.analysis.swingHigh) {
    candidates.push({ price: symbol.analysis.swingHigh, label: "swing high" });
  }
  candidates.push({ price: symbol.h4Low, label: "4H low" });
  candidates.push({ price: symbol.h4High, label: "4H high" });

  const below = candidates
    .filter((c) => c.price < price - 1)
    .sort((a, b) => b.price - a.price)[0] ?? null;
  const above = candidates
    .filter((c) => c.price > price + 1)
    .sort((a, b) => a.price - b.price)[0] ?? null;

  return { below, above };
}

export function buildLevelsContext(
  symbol: SymbolContext,
  market: Awaited<ReturnType<typeof computeMarketContext>>,
  geo: Awaited<ReturnType<typeof getCachedGeopoliticsBrief>>
): LevelsBriefContext {
  const { below, above } = nearestLevels(symbol);
  const cisd = symbol.analysis.cisd?.price ?? null;

  let structure = `${symbol.label} near ${Math.round(symbol.current)}`;
  if (cisd && symbol.current < cisd) {
    structure = `${symbol.label} trading below the ${Math.round(cisd)} CISD reference`;
  } else if (cisd && symbol.current > cisd) {
    structure = `${symbol.label} trading above the ${Math.round(cisd)} CISD reference`;
  }

  return {
    symbol: symbol.label,
    price: symbol.current,
    structure,
    cisd: cisd ? Math.round(cisd) : null,
    levelBelow: below ? Math.round(below.price) : null,
    levelAbove: above ? Math.round(above.price) : null,
    levelBelowLabel: below?.label ?? null,
    levelAboveLabel: above?.label ?? null,
    newsRiskElevated: geoRiskOff(geo.war.text, geo.trump?.text ?? null),
  };
}

function buildPrompt(ctx: LevelsBriefContext): string {
  return `You write ONE neutral structure sentence for public futures context — NOT trade advice.

INPUT JSON:
${JSON.stringify(ctx)}

Return ONLY valid JSON: {"line": ""}

Rules:
- Max 32 words. Plain English. No jargon like "reclaim", "targets", "eye", "watch for longs".
- Describe where price sits vs CISD / imbalance references only using JSON numbers.
- Mention nearby levels below/above as references, not targets.
- If newsRiskElevated is true, end with "News risk remains elevated." or similar — one short clause.
- No trade calls. No directional advice. No "should" or "look for entries".`;
}

function clampLine(text: string, maxWords = 32, maxChars = 220): string {
  let t = text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  const words = t.split(" ").filter(Boolean);
  if (words.length > maxWords) {
    t = `${words.slice(0, maxWords).join(" ")}…`;
  }
  if (t.length > maxChars) {
    t = `${t.slice(0, maxChars - 1).trim()}…`;
  }
  return t;
}

function parseLine(text: string): string | null {
  try {
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed = JSON.parse(cleaned) as { line?: string };
    if (typeof parsed.line !== "string" || !parsed.line.trim()) return null;
    return clampLine(parsed.line.replace(/\*\*/g, "").replace(/\s+/g, " ").trim());
  } catch {
    return null;
  }
}

export function formatLevelsDeterministic(ctx: LevelsBriefContext): string {
  const parts: string[] = [];

  if (ctx.cisd && ctx.structure.includes("CISD")) {
    parts.push(ctx.structure);
  } else {
    parts.push(`${ctx.symbol} near ${Math.round(ctx.price)}`);
  }

  const refs: string[] = [];
  if (ctx.levelBelow) refs.push(`${ctx.levelBelow} below`);
  if (ctx.levelAbove) refs.push(`${ctx.levelAbove} above`);
  if (refs.length) {
    parts.push(`Nearby levels: ${refs.join(", ")}`);
  }

  if (ctx.newsRiskElevated) {
    parts.push("News risk remains elevated");
  }

  return `${parts.join(". ")}.`;
}

async function generateLevelsBrief(
  label: SymbolLabel
): Promise<LevelsBriefPayload> {
  const [market, geo] = await Promise.all([
    computeMarketContext(),
    getCachedGeopoliticsBrief(),
  ]);
  const symbol = pickSymbol(label, market);
  const ctx = buildLevelsContext(symbol, market, geo);
  const fallback = formatLevelsDeterministic(ctx);
  const generatedAt = new Date().toISOString();
  const revalidateSec = isFuturesSessionOpen()
    ? BIAS_SUMMARY_REVALIDATE_SEC
    : BIAS_SUMMARY_CLOSED_REVALIDATE_SEC;

  const base = {
    generatedAt,
    configured: isAiGatewayConfigured(),
    revalidateSec,
  };

  if (!isAiGatewayConfigured()) {
    return { line: fallback, ...base };
  }

  const model = getBiasSummaryModel();
  if (!model) {
    return { line: fallback, ...base };
  }

  try {
    const { text } = await generateText({
      model,
      prompt: buildPrompt(ctx),
      maxOutputTokens: 120,
    });
    const line = parseLine(text) ?? fallback;
    return { line, ...base };
  } catch (error) {
    console.error(`[levels-brief/${label}]`, error);
    return { line: fallback, ...base };
  }
}

function cacheFor(label: SymbolLabel) {
  const open = unstable_cache(
    () => generateLevelsBrief(label),
    [`levels-brief-v4-${label}-open`],
    {
      revalidate: BIAS_SUMMARY_REVALIDATE_SEC,
      tags: ["levels-brief", `levels-brief-${label}`],
    }
  );
  const closed = unstable_cache(
    () => generateLevelsBrief(label),
    [`levels-brief-v4-${label}-closed`],
    {
      revalidate: BIAS_SUMMARY_CLOSED_REVALIDATE_SEC,
      tags: ["levels-brief", `levels-brief-${label}`],
    }
  );
  return { open, closed };
}

const caches = {
  NQ: cacheFor("NQ"),
  ES: cacheFor("ES"),
  GC: cacheFor("GC"),
};

export async function getCachedLevelsBrief(
  label: SymbolLabel
): Promise<LevelsBriefPayload> {
  const c = caches[label];
  return isFuturesSessionOpen() ? c.open() : c.closed();
}
