import { unstable_cache } from "next/cache";
import { generateText } from "ai";
import { getBiasSummaryModel, isAiGatewayConfigured } from "@/lib/ai-gateway";
import {
  BIAS_SUMMARY_CLOSED_REVALIDATE_SEC,
  BIAS_SUMMARY_REVALIDATE_SEC,
} from "@/lib/bias-summary-config";
import { computeMarketContext, type SymbolContext } from "@/lib/htf-status";
import { isFuturesSessionOpen } from "@/lib/futures-session";
import { computeSymbolPrep, type SymbolLabel } from "@/lib/strategy-prep";

export type LevelsBriefPayload = {
  line: string;
  generatedAt: string;
  configured: boolean;
  revalidateSec: number;
};

export type LevelsBriefContext = {
  symbol: string;
  price: number;
  bias: string;
  draw: { side: string; level: number; pts: number };
  h4High: number;
  h4Low: number;
  h1High: number;
  h1Low: number;
  levels: { label: string; price: number; role: string; pts: number }[];
  smt: string | null;
};

function pickSymbol(
  label: SymbolLabel,
  ctx: Awaited<ReturnType<typeof computeMarketContext>>
): SymbolContext {
  if (label === "ES") return ctx.es;
  if (label === "GC") return ctx.gold;
  return ctx.nq;
}

export function buildLevelsContext(
  symbol: SymbolContext,
  market: Awaited<ReturnType<typeof computeMarketContext>>
): LevelsBriefContext {
  const prep = computeSymbolPrep(symbol, market);

  return {
    symbol: symbol.label,
    price: symbol.current,
    bias: prep.bias,
    draw: {
      side: prep.draw.side,
      level: prep.draw.level,
      pts: Math.round(prep.draw.pointsAway),
    },
    h4High: symbol.h4High,
    h4Low: symbol.h4Low,
    h1High: symbol.h1High,
    h1Low: symbol.h1Low,
    levels: prep.keyLevels.slice(0, 4).map((l) => ({
      label: l.label,
      price: l.price,
      role: l.role,
      pts: Math.round(l.pointsAway),
    })),
    smt: symbol.label !== "GC" ? market.smt?.message ?? null : null,
  };
}

function buildPrompt(ctx: LevelsBriefContext): string {
  return `You write ONE plain sentence for a futures trader about key price levels.

INPUT JSON:
${JSON.stringify(ctx)}

Return ONLY valid JSON: {"line": ""}

Rules:
- Exactly ONE sentence, max 35 words. No bullet lists. No raw ranges like "29340-29433".
- Mention draw on liquidity, nearest 4H/1H high/low, and closest FVG or CISD if in JSON — rounded prices only.
- Say above vs below current price. End with what to watch (tap, hold, break).
- Use ONLY JSON facts. No trade calls. No listing every level.`;
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
    return null;
  }
}

export function formatLevelsDeterministic(ctx: LevelsBriefContext): string {
  const { price, symbol, draw, h4High, h4Low, h1High, h1Low } = ctx;
  const drawDir = draw.side === "buy-side" ? "↑" : "↓";

  const above: string[] = [];
  const below: string[] = [];

  if (h4High > price) {
    above.push(`4H high ${Math.round(h4High)} (${Math.round(h4High - price)}pt)`);
  }
  if (h1High > price && Math.abs(h1High - h4High) > 2) {
    above.push(`1H high ${Math.round(h1High)}`);
  }
  if (draw.level > price) {
    above.push(`draw ${drawDir} ${Math.round(draw.level)}`);
  }

  if (h4Low < price) {
    below.push(`4H low ${Math.round(h4Low)} (${Math.round(price - h4Low)}pt)`);
  }
  if (h1Low < price && Math.abs(h1Low - h4Low) > 2) {
    below.push(`1H low ${Math.round(h1Low)}`);
  }
  if (draw.level < price) {
    below.push(`draw ${drawDir} ${Math.round(draw.level)}`);
  }

  for (const lvl of ctx.levels) {
    if (lvl.role === "draw") continue;
    const tag = lvl.role === "fvg" ? "FVG" : lvl.role === "cisd" ? "CISD" : "lvl";
    const snippet = `${tag} ${Math.round(lvl.price)}`;
    if (lvl.price >= price && !above.some((s) => s.includes(String(Math.round(lvl.price))))) {
      above.push(snippet);
    } else if (
      lvl.price < price &&
      !below.some((s) => s.includes(String(Math.round(lvl.price))))
    ) {
      below.push(snippet);
    }
  }

  const up = above.slice(0, 2).join(", ") || "clear air";
  const dn = below.slice(0, 2).join(", ") || "clear air";
  const watch =
    ctx.bias === "bullish"
      ? "watch holds above nearest support"
      : ctx.bias === "bearish"
        ? "watch rejection at overhead levels"
        : "wait for a level to break";

  return `${symbol} ${Math.round(price)} — above: ${up}; below: ${dn}; ${watch}.`;
}

async function generateLevelsBrief(
  label: SymbolLabel
): Promise<LevelsBriefPayload> {
  const market = await computeMarketContext();
  const symbol = pickSymbol(label, market);
  const ctx = buildLevelsContext(symbol, market);
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
      maxOutputTokens: 100,
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
    [`levels-brief-${label}-open`],
    {
      revalidate: BIAS_SUMMARY_REVALIDATE_SEC,
      tags: ["levels-brief", `levels-brief-${label}`],
    }
  );
  const closed = unstable_cache(
    () => generateLevelsBrief(label),
    [`levels-brief-${label}-closed`],
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
