import { getZonedParts } from "@/lib/et-time";
import { getMarketSession } from "@/lib/futures-session";
import type { MarketContext, SmtAlert, SymbolContext } from "@/lib/htf-status";
import { candleSymbolBias } from "@/lib/htf-status";
import {
  keyLevelsFromAnalysis,
  resolveDraw,
  shouldShowDrawOnLiquidity,
} from "@/lib/market-analysis";
import {
  plottedFvgsForTimeframe,
  type ChartTimeframe,
} from "@/lib/chart-timeframe";

const TZ = "America/New_York";

export type HtfBias = "bullish" | "bearish" | "mixed";
export type SymbolLabel = "NQ" | "ES" | "GC";

export type DrawOnLiquidity = {
  side: "buy-side" | "sell-side";
  headline: string;
  level: number;
  symbol: SymbolLabel;
  pointsAway: number;
};

export type KeyLevel = {
  symbol: SymbolLabel;
  label: string;
  price: number;
  role: "draw" | "invalidation" | "intermediate" | "prior" | "fvg" | "cisd";
  pointsAway: number;
};

export type WindowPhase =
  | "closed"
  | "pre-golden"
  | "golden-hour"
  | "post-golden";

export type ExecutionWindow = {
  phase: WindowPhase;
  headline: string;
  detail: string;
  minutesRemaining: number | null;
};

export type SymbolPrep = {
  label: SymbolLabel;
  bias: HtfBias;
  draw: DrawOnLiquidity | null;
  keyLevels: KeyLevel[];
  nearKeyLevel: boolean;
  fvgNarrative: string;
  fvgNet: number;
  esConfirm: boolean | null;
  smt: SmtAlert | null;
  execution: ExecutionWindow;
  confirmLabel: string;
};

export type StrategyPrep = {
  bias: HtfBias;
  biasHeadline: string;
  structure: string;
  narrative: string;
  fvgNarrative: { nq: string; es: string };
  esNqAligned: boolean;
  draw: DrawOnLiquidity | null;
  keyLevels: KeyLevel[];
  smt: SmtAlert | null;
  nearKeyLevel: boolean;
  confirmationHeadline: string;
  confirmationDetail: string;
  execution: ExecutionWindow;
  targetHint: string;
};

export function getExecutionWindow(now = new Date()): ExecutionWindow {
  const session = getMarketSession(now);
  if (!session.isOpen) {
    return {
      phase: "closed",
      headline: "Futures closed",
      detail: "Prep bias & levels before the next session.",
      minutesRemaining: session.minutesUntilOpen,
    };
  }

  const p = getZonedParts(now, TZ);
  const mins = p.hour * 60 + p.minute;
  const goldenStart = 9 * 60 + 30;
  const goldenEnd = 11 * 60;

  if (mins < goldenStart) {
    const until = goldenStart - mins;
    return {
      phase: "pre-golden",
      headline: "Pre golden hour",
      detail: `Primary execution window opens in ${until}m (9:30 ET).`,
      minutesRemaining: until,
    };
  }

  if (mins < goldenEnd) {
    const left = goldenEnd - mins;
    return {
      phase: "golden-hour",
      headline: "Golden hour active",
      detail: "9:30–11:00 ET · primary window for entries.",
      minutesRemaining: left,
    };
  }

  return {
    phase: "post-golden",
    headline: "Past 11 ET",
    detail: "Default rule: no new entries unless A+ setup at fresh key level.",
    minutesRemaining: null,
  };
}

function buildDraw(
  symbol: SymbolContext,
  bias: HtfBias
): DrawOnLiquidity | null {
  if (!shouldShowDrawOnLiquidity(bias)) return null;

  const { drawSide, drawLevel } = resolveDraw(
    bias,
    symbol.analysis.swingHigh,
    symbol.analysis.swingLow,
    symbol.h4High,
    symbol.h4Low,
    symbol.current
  );

  const label = symbol.label as SymbolLabel;

  if (drawSide === "sell-side") {
    return {
      side: "sell-side",
      headline: `${label} swing low · sell-side liquidity`,
      level: drawLevel,
      symbol: label,
      pointsAway: Math.abs(symbol.current - drawLevel),
    };
  }

  return {
    side: "buy-side",
    headline: `${label} swing high · buy-side liquidity`,
    level: drawLevel,
    symbol: label,
    pointsAway: Math.abs(symbol.current - drawLevel),
  };
}

function esConfirmForSymbol(
  symbol: SymbolContext,
  ctx: MarketContext,
  bias: HtfBias
): boolean | null {
  if (symbol.label === "GC") return null;
  if (bias === "mixed") return false;
  return candleSymbolBias(ctx.nq) === candleSymbolBias(ctx.es);
}

function confirmLabelForSymbol(
  symbol: SymbolContext,
  ctx: MarketContext,
  nearKey: boolean,
  execution: ExecutionWindow,
  bias: HtfBias
): string {
  if (symbol.label !== "GC" && ctx.smt) return "SMT";
  if (nearKey && execution.phase === "golden-hour") return "At lvl";
  if (nearKey) return "Near lvl";
  if (bias === "mixed") return "Wait";
  return "Wait";
}

export function computeSymbolPrep(
  symbol: SymbolContext,
  ctx: MarketContext,
  now = new Date()
): SymbolPrep {
  const label = symbol.label as SymbolLabel;
  const bias = candleSymbolBias(symbol);
  const draw = buildDraw(symbol, bias);
  const keyLevels = keyLevelsFromAnalysis(
    label,
    symbol.analysis,
    symbol.current,
    symbol.h1High,
    symbol.h1Low
  );
  const nearKeyLevel = keyLevels.some((l) => l.pointsAway <= 20);
  const execution = getExecutionWindow(now);

  return {
    label,
    bias,
    draw,
    keyLevels,
    nearKeyLevel,
    fvgNarrative: symbol.analysis.fvgNarrative,
    fvgNet: symbol.analysis.fvgScore.net,
    esConfirm: esConfirmForSymbol(symbol, ctx, bias),
    smt: symbol.label === "GC" ? null : ctx.smt,
    execution,
    confirmLabel: confirmLabelForSymbol(
      symbol,
      ctx,
      nearKeyLevel,
      execution,
      bias
    ),
  };
}

export type WatchChip = {
  id: string;
  label: string;
  tone: "bear" | "bull" | "neutral" | "warn" | "draw" | "info";
};

export function symbolWatchChips(
  symbol: SymbolContext,
  ctx: MarketContext,
  chartTf: ChartTimeframe = "4H"
): WatchChip[] {
  const prep = computeSymbolPrep(symbol, ctx);
  const chips: WatchChip[] = [];

  if (prep.draw) {
    const dir = prep.draw.side === "buy-side" ? "↑" : "↓";
    chips.push({
      id: "draw",
      label: `Draw ${dir} ${prep.draw.level.toLocaleString()} · ${Math.round(prep.draw.pointsAway)} pts`,
      tone: "draw",
    });
  }

  for (const { timeframe, fvg } of plottedFvgsForTimeframe(symbol, chartTf)) {
    chips.push({
      id: `${chartTf}-${fvg.id}`,
      label: `${timeframe} ${fvg.type === "bullish" ? "Bull" : "Bear"} ${fvg.bottom.toLocaleString()}–${fvg.top.toLocaleString()} · ${fvg.respect}`,
      tone: fvg.type === "bullish" ? "bull" : "bear",
    });
  }

  if (symbol.label !== "GC" && ctx.smt) {
    chips.push({ id: "smt", label: ctx.smt.message, tone: "warn" });
  } else if (
    symbol.label === "NQ" &&
    ctx.es.analysis.fvgBias !== ctx.nq.analysis.fvgBias
  ) {
    chips.push({
      id: "es-div",
      label: `ES ${ctx.es.analysis.fvgBias} · divergence`,
      tone: "warn",
    });
  } else if (
    symbol.label === "ES" &&
    ctx.es.analysis.fvgBias !== ctx.nq.analysis.fvgBias
  ) {
    chips.push({
      id: "nq-div",
      label: `NQ ${ctx.nq.analysis.fvgBias} · divergence`,
      tone: "warn",
    });
  }

  return chips.slice(0, 4);
}

export function allWatchChips(
  symbol: SymbolContext,
  ctx: MarketContext
): WatchChip[] {
  const seen = new Set<string>();
  const out: WatchChip[] = [];

  for (const tf of ["4H", "1H", "15m"] as ChartTimeframe[]) {
    for (const chip of symbolWatchChips(symbol, ctx, tf)) {
      if (seen.has(chip.id)) continue;
      seen.add(chip.id);
      out.push(chip);
    }
  }

  return out.slice(0, 10);
}

/** @deprecated use symbolWatchChips */
export function symbolWatchItems(
  symbol: SymbolContext,
  ctx: MarketContext
): string[] {
  return symbolWatchChips(symbol, ctx).map((c) => c.label);
}

function candleFallbackBias(ctx: MarketContext): HtfBias {
  const scores = [
    ctx.nq.fourHour.bias,
    ctx.nq.oneHour.bias,
    ctx.es.fourHour.bias,
    ctx.es.oneHour.bias,
  ];
  const bull = scores.filter((b) => b === "bullish").length;
  const bear = scores.filter((b) => b === "bearish").length;
  if (bull >= 3 && bear === 0) return "bullish";
  if (bear >= 3 && bull === 0) return "bearish";
  if (bull >= 2 && bear === 0) return "bullish";
  if (bear >= 2 && bull === 0) return "bearish";
  return "mixed";
}

function computeHtfBias(ctx: MarketContext): HtfBias {
  const nq = ctx.nq.analysis.fvgBias;
  const es = ctx.es.analysis.fvgBias;
  const net = ctx.nq.analysis.fvgScore.net + ctx.es.analysis.fvgScore.net;

  if (nq === es && nq !== "mixed") return nq;
  if (net >= 3) return "bullish";
  if (net <= -3) return "bearish";
  if (nq !== "mixed" && es === "mixed") return nq;
  if (es !== "mixed" && nq === "mixed") return es;

  return candleFallbackBias(ctx);
}

function structureLine(ctx: MarketContext): { line: string; aligned: boolean } {
  const nq = ctx.nq.analysis.fvgBias;
  const es = ctx.es.analysis.fvgBias;

  if (nq === es && nq !== "mixed") {
    return {
      line: `NQ + ES FVG bias both ${nq} (net ${ctx.nq.analysis.fvgScore.net + ctx.es.analysis.fvgScore.net})`,
      aligned: true,
    };
  }
  if (nq === es) {
    return { line: "NQ + ES FVG mixed · no clean HTF read", aligned: false };
  }
  return {
    line: `NQ FVG ${nq} · ES FVG ${es}`,
    aligned: false,
  };
}

function narrativeLine(ctx: MarketContext): string {
  return `NQ: ${ctx.nq.analysis.fvgNarrative} · ES: ${ctx.es.analysis.fvgNarrative}`;
}

function pickDrawSymbol(
  ctx: MarketContext,
  side: "buy-side" | "sell-side"
): SymbolContext {
  if (side === "buy-side") {
    return ctx.relativeStrength.stronger === "ES" ? ctx.es : ctx.nq;
  }
  return ctx.relativeStrength.stronger === "NQ" ? ctx.nq : ctx.es;
}

function computeDraw(ctx: MarketContext, bias: HtfBias): DrawOnLiquidity | null {
  if (!shouldShowDrawOnLiquidity(bias)) return null;
  const sym = pickDrawSymbol(ctx, "sell-side");
  return buildDraw(sym, bias);
}

function isNearKeyLevel(keyLevels: KeyLevel[]): boolean {
  return keyLevels.some((l) => l.pointsAway <= 20);
}

function confirmationCopy(
  ctx: MarketContext,
  bias: HtfBias,
  nearKey: boolean,
  window: ExecutionWindow
): { headline: string; detail: string } {
  if (ctx.smt) {
    return {
      headline: "SMT at liquidity · watch for IFVG",
      detail: `${ctx.smt.message}. After tap, wait for highest TF IFVG in the manipulation leg (1–5m).`,
    };
  }
  if (nearKey && window.phase === "golden-hour") {
    return {
      headline: "At / near key level",
      detail:
        "Do not front-run. Mark manipulation leg (swing into level) → invert highest IFVG in that leg.",
    };
  }
  if (nearKey) {
    return {
      headline: "Price near HTF level",
      detail: "Bias valid · wait for golden hour or clear IFVG before entry.",
    };
  }
  if (bias === "mixed") {
    return {
      headline: "No A+ confirmation yet",
      detail: "Resolve FVG bias (4H/1H + ES/NQ) before hunting IFVG.",
    };
  }
  return {
    headline: "Waiting for tap",
    detail:
      bias === "bullish"
        ? "Bullish HTF · watch FVG/CISD holds — no sell-side draw implied at highs."
        : "Let price reach sell-side draw or FVG/CISD, then IFVG.",
  };
}

export function computeStrategyPrep(
  ctx: MarketContext,
  now = new Date()
): StrategyPrep {
  const bias = computeHtfBias(ctx);
  const { line: structure, aligned: esNqAligned } = structureLine(ctx);
  const draw = computeDraw(ctx, bias);
  const keyLevels = [
    ...keyLevelsFromAnalysis(
      "NQ",
      ctx.nq.analysis,
      ctx.nq.current,
      ctx.nq.h1High,
      ctx.nq.h1Low
    ),
    ...keyLevelsFromAnalysis(
      "ES",
      ctx.es.analysis,
      ctx.es.current,
      ctx.es.h1High,
      ctx.es.h1Low
    ),
  ];
  const nearKeyLevel = isNearKeyLevel(keyLevels);
  const execution = getExecutionWindow(now);
  const { headline: confirmationHeadline, detail: confirmationDetail } =
    confirmationCopy(ctx, bias, nearKeyLevel, execution);

  const biasHeadline =
    bias === "bullish"
      ? "Bullish HTF (FVG)"
      : bias === "bearish"
        ? "Bearish HTF (FVG)"
        : "Mixed · no trade bias";

  const targetHint =
    bias === "mixed"
      ? "Mixed · no draw until FVG bias clears."
      : bias === "bullish"
        ? "Bullish · no draw at ATH — watch FVG holds and continuation."
        : draw
          ? `Low-hanging fruit: ${draw.symbol} @ ${draw.level.toLocaleString()} (${Math.round(draw.pointsAway)}pt) · aim 1:1–1:3 R.`
          : "Bearish · watch sell-side liquidity below.";

  return {
    bias,
    biasHeadline,
    structure,
    narrative: narrativeLine(ctx),
    fvgNarrative: {
      nq: ctx.nq.analysis.fvgNarrative,
      es: ctx.es.analysis.fvgNarrative,
    },
    esNqAligned,
    draw,
    keyLevels,
    smt: ctx.smt,
    nearKeyLevel,
    confirmationHeadline,
    confirmationDetail,
    execution,
    targetHint,
  };
}

export function formatPrice(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
