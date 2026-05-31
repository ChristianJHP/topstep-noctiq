import type { CandleBias, MarketContext } from "@/lib/htf-status";
import type { EconomicEvent } from "@/lib/events";

export type MarketTone = "green" | "red" | "mixed";
export type RangeZone = "near-highs" | "mid-range" | "near-lows";
export type NewsRiskLevel = "clear" | "red-folder" | "headline";

export type MarketStateSnapshot = {
  tone: MarketTone;
  toneLabel: string;
  rangeZone: RangeZone;
  rangeLabel: string;
  alignment: string;
  rsLabel: string;
  newsRisk: NewsRiskLevel;
  newsRiskLabel: string;
};

function biasValue(b: CandleBias): number {
  if (b === "bullish") return 1;
  if (b === "bearish") return -1;
  return 0;
}

function rangeZoneFromPct(avgPct: number): RangeZone {
  if (avgPct >= 72) return "near-highs";
  if (avgPct <= 28) return "near-lows";
  return "mid-range";
}

function rangeLabel(zone: RangeZone): string {
  if (zone === "near-highs") return "NEAR HIGHS";
  if (zone === "near-lows") return "NEAR LOWS";
  return "MID-RANGE";
}

function computeTone(ctx: MarketContext): MarketTone {
  const scores = [
    biasValue(ctx.nq.fourHour.bias),
    biasValue(ctx.nq.oneHour.bias),
    biasValue(ctx.es.fourHour.bias),
    biasValue(ctx.es.oneHour.bias),
  ];
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (avg >= 0.5) return "green";
  if (avg <= -0.5) return "red";
  return "mixed";
}

function computeAlignment(ctx: MarketContext): string {
  const nq4 = ctx.nq.fourHour.bias;
  const es4 = ctx.es.fourHour.bias;
  const nq1 = ctx.nq.oneHour.bias;
  const es1 = ctx.es.oneHour.bias;

  if (nq4 === es4 && nq1 === es1 && nq4 !== "neutral") {
    return nq4 === "bullish" ? "Both bullish" : "Both bearish";
  }
  if (nq4 === es4 && nq4 !== "neutral") {
    return nq4 === "bullish" ? "4H both bull" : "4H both bear";
  }
  if (nq4 !== es4) return "4H diverging";
  return "Flat / mixed";
}

function computeNewsRisk(
  nextEvent: EconomicEvent | null | undefined,
  hasHeadline: boolean
): { level: NewsRiskLevel; label: string } {
  if (hasHeadline) {
    return { level: "headline", label: "Active headline risk" };
  }
  if (nextEvent) {
    const ms = new Date(nextEvent.scheduledAt).getTime() - Date.now();
    if (ms > 0 && ms <= 48 * 60 * 60 * 1000) {
      return { level: "red-folder", label: "Upcoming red folder" };
    }
  }
  return { level: "clear", label: "Clear" };
}

export function computeMarketState(
  ctx: MarketContext,
  opts?: {
    nextEvent?: EconomicEvent | null;
    hasHeadline?: boolean;
  }
): MarketStateSnapshot {
  const tone = computeTone(ctx);
  const avgPct = (ctx.nq.pctInH4Range + ctx.es.pctInH4Range) / 2;
  const rangeZone = rangeZoneFromPct(avgPct);
  const { level: newsRisk, label: newsRiskLabel } = computeNewsRisk(
    opts?.nextEvent,
    opts?.hasHeadline ?? false
  );

  let rsLabel = "Similar";
  if (ctx.relativeStrength.stronger === "NQ") rsLabel = "NQ leading";
  else if (ctx.relativeStrength.stronger === "ES") rsLabel = "ES leading";

  return {
    tone,
    toneLabel: tone === "green" ? "GREEN" : tone === "red" ? "RED" : "MIXED",
    rangeZone,
    rangeLabel: rangeLabel(rangeZone),
    alignment: computeAlignment(ctx),
    rsLabel,
    newsRisk,
    newsRiskLabel,
  };
}

export function formatPrice(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
