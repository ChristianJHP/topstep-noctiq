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
import { getCachedGeopoliticsBrief } from "@/lib/geopolitics-brief";

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
  geo: {
    war: string;
    trump: string | null;
    expect: string;
    riskOff: boolean;
  };
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

export function buildLevelsContext(
  symbol: SymbolContext,
  market: Awaited<ReturnType<typeof computeMarketContext>>,
  geo: Awaited<ReturnType<typeof getCachedGeopoliticsBrief>>
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
    geo: {
      war: geo.war,
      trump: geo.trump,
      expect: geo.expect,
      riskOff: geoRiskOff(geo.war, geo.trump),
    },
  };
}

function buildPrompt(ctx: LevelsBriefContext): string {
  const symbolRules =
    ctx.symbol === "GC"
      ? `- GC: tie war/Trump backdrop to safe-haven flow. On risk-off headlines, gold often bids while NQ/ES sell — say if that fits now. Mention nearest 4H/FVG level.`
      : ctx.symbol === "ES"
        ? `- ES: broad US risk gauge — same macro as NQ but less tech beta. Tie Trump/war news to gap/vol risk and nearest draw or 4H level.`
        : `- NQ: tech/risk-on sensitivity — Trump tariffs/war headlines can gap NQ harder than ES. Tie headline tone to bias and nearest draw/FVG/4H level.`;

  return `You write ONE plain sentence for a futures trader — technical levels PLUS how current war/Trump news affects THIS symbol.

INPUT JSON:
${JSON.stringify(ctx)}

Return ONLY valid JSON: {"line": ""}

Rules:
- Exactly ONE sentence, max 28 words. No bullet lists. No raw ranges.
- One geo hook max (3–5 words), then bias + nearest level + watch.
- Mention draw on liquidity and nearest 4H/1H or FVG level with rounded prices.
${symbolRules}
- Use ONLY JSON facts + geo fields. No trade calls. Trader shorthand OK ("cuz", "rn").`;
}

function clampLine(text: string, maxWords = 28, maxChars = 175): string {
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
  const { price, symbol, draw, h4High, h4Low, bias, geo } = ctx;
  const drawDir = draw.side === "buy-side" ? "↑" : "↓";
  const roundedDraw = Math.round(draw.level);

  const geoBit =
    symbol === "GC" && geo.riskOff
      ? "War headlines bid safe haven — gold often inverse NQ on risk-off; "
      : geo.riskOff && symbol !== "GC"
        ? "Risk-off geo leans heavy on index; "
        : geo.trump
          ? "Trump headline in play; "
          : "";

  const levelBit =
    draw.level > price
      ? `draw ${drawDir} ${roundedDraw} overhead, 4H high ${Math.round(h4High)}`
      : draw.level < price
        ? `draw ${drawDir} ${roundedDraw} below, 4H low ${Math.round(h4Low)}`
        : `4H range ${Math.round(h4Low)}–${Math.round(h4High)}`;

  const watch =
    bias === "bullish"
      ? "watch holds on dips"
      : bias === "bearish"
        ? "watch rejection at supply"
        : "wait for geo or level to break";

  return `${geoBit}${symbol} ${Math.round(price)} ${bias} — ${levelBit}; ${watch}.`;
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
    [`levels-brief-v3-${label}-open`],
    {
      revalidate: BIAS_SUMMARY_REVALIDATE_SEC,
      tags: ["levels-brief", `levels-brief-${label}`],
    }
  );
  const closed = unstable_cache(
    () => generateLevelsBrief(label),
    [`levels-brief-v3-${label}-closed`],
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
