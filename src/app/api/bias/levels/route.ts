import { NextResponse } from "next/server";
import { biasSummaryCacheControl } from "@/lib/bias-summary-config";
import { isFuturesSessionOpen } from "@/lib/futures-session";
import {
  formatLevelsDeterministic,
  buildLevelsContext,
  getCachedLevelsBrief,
} from "@/lib/levels-brief";
import { computeMarketContext } from "@/lib/htf-status";
import type { SymbolLabel } from "@/lib/strategy-prep";

const VALID: SymbolLabel[] = ["NQ", "ES", "GC"];

function parseSymbol(raw: string | null): SymbolLabel | null {
  if (raw === "NQ" || raw === "ES" || raw === "GC") return raw;
  if (raw === "Gold") return "GC";
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
    const payload = await getCachedLevelsBrief(label);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": cacheControl },
    });
  } catch (error) {
    console.error("[bias/levels]", error);
    try {
      const market = await computeMarketContext();
      const symbol =
        label === "ES" ? market.es : label === "GC" ? market.gold : market.nq;
      const ctx = buildLevelsContext(symbol, market);
      return NextResponse.json(
        {
          line: formatLevelsDeterministic(ctx),
          generatedAt: new Date().toISOString(),
          configured: false,
          stale: true,
          revalidateSec: 60,
        },
        { headers: { "Cache-Control": "public, max-age=60" } }
      );
    } catch {
      return NextResponse.json(
        { line: "Levels unavailable.", error: "unavailable" },
        { status: 503, headers: { "Cache-Control": "public, max-age=60" } }
      );
    }
  }
}
