import { NextResponse } from "next/server";
import { biasSummaryCacheControl } from "@/lib/bias-summary-config";
import { isFuturesSessionOpen } from "@/lib/futures-session";
import {
  buildInstrumentBiasContext,
  formatInstrumentBiasDeterministic,
  getCachedInstrumentBiasBrief,
  getFreshInstrumentBiasBrief,
} from "@/lib/instrument-bias-brief";
import { resolveSummaryOverlays } from "@/lib/summary-chart-overlays";
import type { SymbolLabel } from "@/lib/strategy-prep";

const VALID: SymbolLabel[] = ["NQ", "ES", "GC"];

function parseSymbol(raw: string | null): SymbolLabel | null {
  if (raw === "NQ" || raw === "ES" || raw === "GC") return raw;
  if (raw === "GOLD") return "GC";
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const label = parseSymbol(url.searchParams.get("symbol")?.toUpperCase() ?? null);
  const fresh = url.searchParams.get("fresh") === "1";
  const reaction = url.searchParams.get("reaction")?.trim() || undefined;

  if (!label) {
    return NextResponse.json(
      { error: "symbol required (NQ, ES, GC)" },
      { status: 400 }
    );
  }

  const marketClosed = !isFuturesSessionOpen();

  if (fresh) {
    try {
      const payload = await getFreshInstrumentBiasBrief(label, reaction);
      return NextResponse.json(payload, {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      console.error("[bias/instrument-summary fresh]", error);
    }
  }

  const cacheControl = biasSummaryCacheControl(marketClosed);

  try {
    const payload = await getCachedInstrumentBiasBrief(label);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": cacheControl },
    });
  } catch (error) {
    console.error("[bias/instrument-summary]", error);
    try {
      const ctx = await buildInstrumentBiasContext(label);
      const tradeMap = formatInstrumentBiasDeterministic(ctx);
      const line = `${tradeMap.headline} ${tradeMap.context}`;
      return NextResponse.json(
        {
          line,
          tradeMap,
          overlays: resolveSummaryOverlays(line, ctx),
          symbol: label,
          generatedAt: new Date().toISOString(),
          configured: false,
          marketOpen: ctx.marketOpen,
          stale: true,
          revalidateSec: 60,
        },
        { headers: { "Cache-Control": "public, max-age=60" } }
      );
    } catch {
      return NextResponse.json(
        { line: "Bias summary unavailable.", symbol: label, error: "unavailable" },
        { status: 503, headers: { "Cache-Control": "public, max-age=60" } }
      );
    }
  }
}
