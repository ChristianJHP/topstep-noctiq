import { unstable_cache } from "next/cache";
import { generateText } from "ai";
import { getBiasSummaryModel, isAiGatewayConfigured } from "@/lib/ai-gateway";
import {
  BIAS_SUMMARY_CLOSED_REVALIDATE_SEC,
  BIAS_SUMMARY_REVALIDATE_SEC,
} from "@/lib/bias-summary-config";
import { fetchCalendarMeta, pickNextHighImpact } from "@/lib/events";
import { getMarketSession, isFuturesSessionOpen } from "@/lib/futures-session";
import { computeMarketContext, type SymbolContext } from "@/lib/htf-status";
import { getCachedGeopoliticsBrief } from "@/lib/geopolitics-brief";
import { filterNewsForInstrument } from "@/lib/instrument-news";
import {
  computeSymbolPrep,
  type HtfBias,
  type SymbolLabel,
} from "@/lib/strategy-prep";
import { getTradingSessionInfo } from "@/lib/trading-session";

export type InstrumentBiasPayload = {
  line: string;
  symbol: SymbolLabel;
  generatedAt: string;
  configured: boolean;
  marketOpen: boolean;
  revalidateSec: number;
};

export type InstrumentBiasContext = {
  symbol: SymbolLabel;
  price: number;
  marketOpen: boolean;
  sessionLabel: string;
  perceivedBias: HtfBias;
  htf: {
    oneHour: string;
    fourHour: string;
    pctIn4HRange: number;
    pctIn1HRange: number;
    distTo4HHighPts: number;
    distTo4HLowPts: number;
  };
  premiumDiscount: "premium" | "discount" | "equilibrium";
  drawOnLiquidity: {
    side: string;
    level: number;
    pointsAway: number;
  } | null;
  fvgNarrative: string;
  fvgNet: number;
  keyLevels: { label: string; price: number; role: string }[];
  cisd: number | null;
  esConfirm: boolean | null;
  relativeStrength: string | null;
  smt: string | null;
  topHeadlines: string[];
  geo: { war: string; trump: string | null; marketsTone: string };
  nextRedFolder: { title: string; minutesUntil: number } | null;
  minutesTo1HClose: number | null;
};

function pickSymbol(
  label: SymbolLabel,
  ctx: Awaited<ReturnType<typeof computeMarketContext>>
): SymbolContext {
  if (label === "ES") return ctx.es;
  if (label === "GC") return ctx.gold;
  return ctx.nq;
}

function premiumDiscountFromPct(pct: number): "premium" | "discount" | "equilibrium" {
  if (pct >= 62) return "premium";
  if (pct <= 38) return "discount";
  return "equilibrium";
}

export async function buildInstrumentBiasContext(
  label: SymbolLabel
): Promise<InstrumentBiasContext> {
  const [market, geo, cal] = await Promise.all([
    computeMarketContext(),
    getCachedGeopoliticsBrief(),
    fetchCalendarMeta(),
  ]);

  const symbol = pickSymbol(label, market);
  const prep = computeSymbolPrep(symbol, market);
  const session = getMarketSession();
  const tradingSession = getTradingSessionInfo();
  const next = pickNextHighImpact(cal.events);

  const headlines = filterNewsForInstrument(geo.feed, label, 4).map((h) => h.text);

  let relativeStrength: string | null = null;
  if (label === "NQ" || label === "ES") {
    relativeStrength = market.relativeStrength.headline || null;
    if (prep.esConfirm === true) {
      relativeStrength = `${relativeStrength ?? "ES/NQ"} · ES confirms`;
    } else if (prep.esConfirm === false) {
      relativeStrength = `${relativeStrength ?? "ES/NQ"} · ES diverging`;
    }
  } else if (geo.markets) {
    relativeStrength = geo.markets.slice(0, 80);
  }

  return {
    symbol: label,
    price: Math.round(symbol.current),
    marketOpen: session.isOpen,
    sessionLabel: tradingSession.isMarketOpen
      ? tradingSession.label
      : "Closed",
    perceivedBias: prep.bias,
    htf: {
      oneHour: symbol.oneHour.colorLabel || symbol.oneHour.bias,
      fourHour: symbol.fourHour.colorLabel || symbol.fourHour.bias,
      pctIn4HRange: Math.round(symbol.pctInH4Range),
      pctIn1HRange: Math.round(symbol.pctInH1Range),
      distTo4HHighPts: Math.round(symbol.distances.toH4High),
      distTo4HLowPts: Math.round(symbol.distances.toH4Low),
    },
    premiumDiscount: premiumDiscountFromPct(symbol.pctInH4Range),
    drawOnLiquidity: prep.draw
      ? {
          side: prep.draw.side,
          level: Math.round(prep.draw.level),
          pointsAway: Math.round(prep.draw.pointsAway),
        }
      : null,
    fvgNarrative: prep.fvgNarrative,
    fvgNet: prep.fvgNet,
    keyLevels: prep.keyLevels.slice(0, 4).map((l) => ({
      label: l.label,
      price: Math.round(l.price),
      role: l.role,
    })),
    cisd: symbol.analysis.cisd
      ? Math.round(symbol.analysis.cisd.price)
      : null,
    esConfirm: label === "GC" ? null : prep.esConfirm,
    relativeStrength,
    smt: label === "GC" ? null : market.smt?.message ?? null,
    topHeadlines: headlines,
    geo: {
      war: geo.war.text,
      trump: geo.trump?.text ?? null,
      marketsTone: geo.markets,
    },
    nextRedFolder: next
      ? {
          title: next.title,
          minutesUntil: Math.max(
            0,
            Math.round(
              (new Date(next.scheduledAt).getTime() - Date.now()) / 60_000
            )
          ),
        }
      : null,
    minutesTo1HClose: session.minutesTo1HClose,
  };
}

function buildPrompt(ctx: InstrumentBiasContext): string {
  const closed = !ctx.marketOpen;

  return `You write ONE sentence for ${ctx.symbol} futures — the perceived directional bias for the next 2–3 hours and WHY (not trade advice).

INPUT JSON:
${JSON.stringify(ctx)}

Return ONLY valid JSON: {"line": ""}

The sentence must weave in relevant drivers from JSON only, such as:
${closed
    ? `- Markets closed: last known HTF bias, PD array (premiumDiscount), sessionLabel, and headline/geo context for the next open.`
    : `- perceivedBias lean and HTF 1H/4H candle alignment.
- premiumDiscount vs the 4H range (PD array).
- drawOnLiquidity if present.
- Active sessionLabel (Asia/London/NY).
- topHeadlines, geo.war, geo.trump, or geo.marketsTone if they explain the lean for this symbol.
- relativeStrength / smt for NQ or ES when relevant.
- nextRedFolder within ~6h if material.`}

Rules:
- Exactly ONE sentence, max 45 words. Plain English.
- Speculative lean is OK ("may grind", "bias favors", "watch for") — no entries, stops, or targets.
- Use ONLY JSON facts. Do not invent prices or headlines.
- If a driver is missing, omit it rather than guessing.`;
}

function clampLine(text: string, maxWords = 45, maxChars = 280): string {
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
    return clampLine(parsed.line);
  } catch {
    return null;
  }
}

export function formatInstrumentBiasDeterministic(
  ctx: InstrumentBiasContext
): string {
  if (!ctx.marketOpen) {
    return clampLine(
      `${ctx.symbol} closed (${ctx.sessionLabel}) — last ${ctx.price.toLocaleString()}; ${ctx.perceivedBias} HTF (${ctx.htf.fourHour} 4H, ${ctx.htf.oneHour} 1H) heading into reopen.`
    );
  }

  const bits: string[] = [
    `${ctx.symbol} ${ctx.perceivedBias} lean next few hours`,
    `${ctx.htf.fourHour} 4H / ${ctx.htf.oneHour} 1H`,
    `${ctx.premiumDiscount} vs 4H range`,
    `${ctx.sessionLabel} session`,
  ];

  if (ctx.drawOnLiquidity) {
    bits.push(
      `draw ${ctx.drawOnLiquidity.side} ${ctx.drawOnLiquidity.level.toLocaleString()}`
    );
  }

  if (ctx.topHeadlines[0]) {
    bits.push(`headline: ${ctx.topHeadlines[0].slice(0, 55)}`);
  } else if (ctx.geo.trump) {
    bits.push(`Trump: ${ctx.geo.trump.slice(0, 45)}`);
  } else if (/war|strike|iran|russia|sanction/i.test(ctx.geo.war)) {
    bits.push(ctx.geo.war.slice(0, 50));
  }

  if (ctx.relativeStrength && (ctx.symbol === "NQ" || ctx.symbol === "ES")) {
    bits.push(ctx.relativeStrength.slice(0, 40));
  }

  return clampLine(`${bits.join("; ")}.`);
}

async function generateInstrumentBiasBrief(
  label: SymbolLabel
): Promise<InstrumentBiasPayload> {
  const ctx = await buildInstrumentBiasContext(label);
  const fallback = formatInstrumentBiasDeterministic(ctx);
  const generatedAt = new Date().toISOString();
  const marketOpen = ctx.marketOpen;
  const revalidateSec = marketOpen
    ? BIAS_SUMMARY_REVALIDATE_SEC
    : BIAS_SUMMARY_CLOSED_REVALIDATE_SEC;

  const base = {
    symbol: label,
    generatedAt,
    configured: isAiGatewayConfigured(),
    marketOpen,
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
      maxOutputTokens: 140,
    });
    const line = parseLine(text) ?? fallback;
    return { line, ...base };
  } catch (error) {
    console.error(`[instrument-bias/${label}]`, error);
    return { line: fallback, ...base };
  }
}

function cacheFor(label: SymbolLabel) {
  const open = unstable_cache(
    () => generateInstrumentBiasBrief(label),
    [`instrument-bias-v1-${label}-open`],
    {
      revalidate: BIAS_SUMMARY_REVALIDATE_SEC,
      tags: ["instrument-bias", `instrument-bias-${label}`],
    }
  );
  const closed = unstable_cache(
    () => generateInstrumentBiasBrief(label),
    [`instrument-bias-v1-${label}-closed`],
    {
      revalidate: BIAS_SUMMARY_CLOSED_REVALIDATE_SEC,
      tags: ["instrument-bias", `instrument-bias-${label}`],
    }
  );
  return { open, closed };
}

const caches = {
  NQ: cacheFor("NQ"),
  ES: cacheFor("ES"),
  GC: cacheFor("GC"),
};

export async function getCachedInstrumentBiasBrief(
  label: SymbolLabel
): Promise<InstrumentBiasPayload> {
  const c = caches[label];
  return isFuturesSessionOpen() ? c.open() : c.closed();
}
