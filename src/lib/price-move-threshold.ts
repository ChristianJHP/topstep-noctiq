import type { SymbolLabel } from "@/lib/strategy-prep";

export type PriceSample = { t: number; price: number };

export type SignificantMove = {
  deltaPts: number;
  deltaPct: number;
  direction: "up" | "down";
  windowMs: number;
};

const WINDOW_MS = 120_000;
const MIN_SAMPLES = 2;

/** Minimum move to trigger a live bias/news refresh (points and %). */
const THRESHOLDS: Record<
  SymbolLabel,
  { minPts: number; minPct: number }
> = {
  NQ: { minPts: 22, minPct: 0.001 },
  ES: { minPts: 8, minPct: 0.0012 },
  GC: { minPts: 2.5, minPct: 0.0006 },
};

export function prunePriceHistory(
  samples: PriceSample[],
  now = Date.now()
): PriceSample[] {
  return samples.filter((s) => now - s.t <= WINDOW_MS);
}

export function detectSignificantMove(
  symbol: SymbolLabel,
  samples: PriceSample[],
  now = Date.now()
): SignificantMove | null {
  const history = prunePriceHistory(samples, now);
  if (history.length < MIN_SAMPLES) return null;

  const oldest = history[0]!;
  const latest = history[history.length - 1]!;
  const deltaPts = latest.price - oldest.price;
  const deltaPct = deltaPts / oldest.price;
  const absPts = Math.abs(deltaPts);
  const absPct = Math.abs(deltaPct);
  const { minPts, minPct } = THRESHOLDS[symbol];

  if (absPts < minPts && absPct < minPct) return null;

  return {
    deltaPts,
    deltaPct,
    direction: deltaPts >= 0 ? "up" : "down",
    windowMs: latest.t - oldest.t,
  };
}

export const PRICE_REACTION_COOLDOWN_MS = 40_000;
