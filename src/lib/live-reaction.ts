import type { SignificantMove } from "@/lib/price-move-threshold";
import type { SymbolLabel } from "@/lib/strategy-prep";

function displayName(symbol: SymbolLabel): string {
  if (symbol === "GC") return "Gold";
  return symbol;
}

function formatPts(symbol: SymbolLabel, pts: number): string {
  const abs = Math.abs(pts);
  if (symbol === "GC") return abs.toFixed(1);
  return String(Math.round(abs));
}

function formatPct(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${(pct * 100).toFixed(2)}%`;
}

export function formatLivePriceReaction(
  symbol: SymbolLabel,
  move: SignificantMove
): string {
  const name = displayName(symbol);
  const dir = move.direction === "up" ? "spiked" : "dropped";
  const mins = Math.max(1, Math.round(move.windowMs / 60_000));
  return `Live: ${name} ${dir} ${formatPts(symbol, move.deltaPts)} pts (${formatPct(move.deltaPct)}) in ~${mins}m — refreshing bias & news.`;
}

export function mergeReactionIntoNewsLine(
  newsLine: string,
  reaction: string
): string {
  if (newsLine.includes("Live:")) return newsLine;
  return `${reaction} ${newsLine}`;
}
