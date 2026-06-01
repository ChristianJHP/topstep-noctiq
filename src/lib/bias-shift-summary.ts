import { generateText } from "ai";
import { getBiasSummaryModel, isAiGatewayConfigured } from "@/lib/ai-gateway";
import type { MarketContext } from "@/lib/htf-status";
import type { HtfBias, SymbolLabel } from "@/lib/strategy-prep";

export type BiasShiftItem = {
  symbol: SymbolLabel;
  from: HtfBias;
  to: HtfBias;
};

export type ShiftSymbolSnapshot = {
  fourHour: string;
  oneHour: string;
  fvgBias: string;
  fvgNet: number;
  fvgNarrative: string;
  expansion: string;
  pctInH4Range: number;
};

export type BiasShiftSummaryContext = {
  shifts: BiasShiftItem[];
  symbols: Partial<Record<SymbolLabel, ShiftSymbolSnapshot>>;
  esNqAligned: boolean;
  smt: string | null;
};

function biasWord(b: HtfBias): string {
  if (b === "bullish") return "bull";
  if (b === "bearish") return "bear";
  return "mixed";
}

export function buildShiftSummaryContext(
  markets: MarketContext,
  shifts: BiasShiftItem[]
): BiasShiftSummaryContext {
  const pick = (label: SymbolLabel): ShiftSymbolSnapshot | undefined => {
    const sym =
      label === "NQ"
        ? markets.nq
        : label === "ES"
          ? markets.es
          : markets.gold;
    return {
      fourHour: sym.fourHour.label,
      oneHour: sym.oneHour.label,
      fvgBias: sym.analysis.fvgBias,
      fvgNet: sym.analysis.fvgScore.net,
      fvgNarrative: sym.analysis.fvgNarrative,
      expansion: sym.expansion,
      pctInH4Range: Math.round(sym.pctInH4Range),
    };
  };

  const symbols: Partial<Record<SymbolLabel, ShiftSymbolSnapshot>> = {};
  for (const s of shifts) {
    symbols[s.symbol] = pick(s.symbol);
  }

  return {
    shifts,
    symbols,
    esNqAligned:
      markets.nq.analysis.fvgBias === markets.es.analysis.fvgBias &&
      markets.nq.analysis.fvgBias !== "mixed",
    smt: markets.smt?.message ?? null,
  };
}

export function formatShiftSummaryDeterministic(
  ctx: BiasShiftSummaryContext
): string {
  const parts = ctx.shifts.map((s) => {
    const snap = ctx.symbols[s.symbol];
    if (!snap) {
      return `${s.symbol} ${biasWord(s.from)}→${biasWord(s.to)}`;
    }
    const tf =
      snap.fourHour === snap.oneHour
        ? `${snap.fourHour} 4H+1H`
        : `${snap.fourHour} 4H / ${snap.oneHour} 1H`;
    const fvg = snap.fvgNet !== 0 ? ` · FVG net ${snap.fvgNet > 0 ? "+" : ""}${snap.fvgNet}` : "";
    return `${s.symbol} ${biasWord(s.to)} · ${tf}${fvg}`;
  });

  let line = parts.join(" · ");
  if (ctx.smt) line += ` · ${ctx.smt}`;
  return line.slice(0, 160);
}

function buildPrompt(ctx: BiasShiftSummaryContext): string {
  return `Bias just shifted on a futures dashboard. Explain WHY in one ultra-short phrase.

INPUT JSON:
${JSON.stringify(ctx)}

Return ONLY valid JSON: {"line": ""}

Rules:
- Max 12 words. One line. No markdown.
- Cite ONLY facts from JSON (4H/1H candle, FVG bias/net/narrative, expansion, shift from→to).
- Say what flipped structure — e.g. "1H closed bear into 4H supply" or "bull FVG disrespected on NQ".
- If multiple symbols shifted, one combined phrase. No advice.`;
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
    return fallback.length > 6 && fallback.length < 120 ? fallback : null;
  }
}

export async function generateBiasShiftSummary(
  ctx: BiasShiftSummaryContext
): Promise<{ line: string; configured: boolean }> {
  const fallback = formatShiftSummaryDeterministic(ctx);

  const model = getBiasSummaryModel();
  if (!model || !isAiGatewayConfigured()) {
    return { line: fallback, configured: false };
  }

  try {
    const { text } = await generateText({
      model,
      prompt: buildPrompt(ctx),
      maxOutputTokens: 60,
    });
    const line = parseLine(text);
    return { line: line ?? fallback, configured: true };
  } catch (error) {
    console.error("[bias-shift-summary]", error);
    return { line: fallback, configured: true };
  }
}
