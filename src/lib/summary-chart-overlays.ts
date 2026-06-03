import type { ChartOverlayKey, ChartOverlaySettings } from "@/lib/chart-overlay-types";
import { DEFAULT_CHART_OVERLAYS } from "@/lib/chart-overlay-types";
import type { InstrumentBiasContext } from "@/lib/instrument-bias-brief";

const ALL_KEYS: ChartOverlayKey[] = [
  "draw",
  "fvg",
  "rejection",
  "cisd",
  "session",
  "levels",
];

/** Detect overlay relevance from the rendered summary sentence. */
export function overlaysFromSummaryText(line: string): ChartOverlaySettings {
  const t = line.toLowerCase();

  return {
    draw:
      /\bdraw\b/.test(t) ||
      /liquidity/.test(t) ||
      /\bssl\b|\bbsl\b/.test(t) ||
      /buy[- ]?side|sell[- ]?side/.test(t),
    fvg:
      /\bfvg\b/.test(t) ||
      /fair value/.test(t) ||
      /value gap/.test(t) ||
      /imbalance/.test(t),
    rejection:
      /\brejection\b/.test(t) ||
      /\brb\b/.test(t) ||
      /order block/.test(t),
    cisd: /\bcisd\b/.test(t) || /change in state of delivery/.test(t),
    session:
      /\bsession\b/.test(t) ||
      /\basia\b/.test(t) ||
      /\blondon\b/.test(t) ||
      /\bny\b/.test(t) ||
      /new york/.test(t),
    levels:
      /\blevel/.test(t) ||
      /\b4h\b/.test(t) ||
      /\b1h\b/.test(t) ||
      /premium/.test(t) ||
      /discount/.test(t) ||
      /pd array/.test(t) ||
      /\bhtf\b/.test(t) ||
      /range (high|low)/.test(t) ||
      /(high|low) of/.test(t),
  };
}

/** Fallback when the model omits overlay flags — uses structured bias context. */
export function overlaysFromBiasContext(
  ctx: InstrumentBiasContext
): ChartOverlaySettings {
  return {
    draw: Boolean(ctx.drawOnLiquidity),
    fvg:
      ctx.fvgNet !== 0 ||
      /fvg|gap|imbalance|bullish|bearish/i.test(ctx.fvgNarrative),
    rejection: false,
    cisd: ctx.cisd != null,
    session: Boolean(ctx.sessionLabel && ctx.marketOpen),
    levels:
      ctx.keyLevels.length > 0 ||
      ctx.premiumDiscount !== "equilibrium" ||
      ctx.htf.distTo4HHighPts < 120 ||
      ctx.htf.distTo4HLowPts < 120,
  };
}

export function resolveSummaryOverlays(
  line: string,
  ctx?: InstrumentBiasContext,
  modelOverlays?: Partial<ChartOverlaySettings> | null
): ChartOverlaySettings {
  if (modelOverlays && ALL_KEYS.every((k) => typeof modelOverlays[k] === "boolean")) {
    return { ...DEFAULT_CHART_OVERLAYS, ...modelOverlays };
  }

  const fromText = overlaysFromSummaryText(line);
  const mentioned = ALL_KEYS.some((k) => fromText[k]);

  if (mentioned) return fromText;

  if (ctx) return overlaysFromBiasContext(ctx);

  return { ...DEFAULT_CHART_OVERLAYS };
}

export function parseModelOverlays(
  raw: unknown
): Partial<ChartOverlaySettings> | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const out: Partial<ChartOverlaySettings> = {};
  for (const key of ALL_KEYS) {
    if (typeof o[key] === "boolean") out[key] = o[key];
  }
  return Object.keys(out).length ? out : null;
}
