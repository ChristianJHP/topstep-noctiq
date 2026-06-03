import { NextResponse } from "next/server";
import { biasSummaryCacheControl } from "@/lib/bias-summary-config";
import { isFuturesSessionOpen } from "@/lib/futures-session";
import {
  buildInstrumentBiasContext,
  formatInstrumentBiasDeterministic,
  getCachedInstrumentBiasBrief,
} from "@/lib/instrument-bias-brief";
import type { SymbolLabel } from "@/lib/strategy-prep";

const VALID: SymbolLabel[] = ["NQ", "ES", "GC"];

function parseSymbol(raw: string | null): SymbolLabel | null {
  if (raw === "NQ" || raw === "ES" || raw === "GC") return raw;
  if (raw === "GOLD") return "GC";
  return null;
}

export async function GET(request: Request) {
  const label = parseSymbol(
    new URL(request.url).searchParams.get("symbol")?.toUpperCase() ?? null
  );

  if (!label) {
    return NextResponse.json(
      { error: "symbol required (NQ, ES, GC)" },
      { status: 400 }
    );
  }

  const marketClosed = !isFuturesSessionOpen();
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
      return NextResponse.json(
        {
          line: formatInstrumentBiasDeterministic(ctx),
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
