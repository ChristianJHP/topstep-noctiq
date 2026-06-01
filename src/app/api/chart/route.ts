import { NextRequest, NextResponse } from "next/server";
import { chartCandlesCacheControl } from "@/lib/chart-cache-config";
import {
  getCachedChartCandles,
  fetchFreshChartCandles,
} from "@/lib/chart-candles-cache";
import { isFuturesSessionOpen } from "@/lib/futures-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker");
  if (!ticker) {
    return NextResponse.json({ error: "Missing ticker" }, { status: 400 });
  }

  const interval = request.nextUrl.searchParams.get("interval") ?? "60m";
  const range = request.nextUrl.searchParams.get("range") ?? "5d";
  const fresh = request.nextUrl.searchParams.get("fresh") === "1";
  const cacheControl = fresh
    ? "no-store"
    : chartCandlesCacheControl(!isFuturesSessionOpen());

  try {
    const payload = fresh
      ? await fetchFreshChartCandles(ticker, interval, range)
      : await getCachedChartCandles(ticker, interval, range);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": cacheControl },
    });
  } catch (error) {
    console.error("[chart]", error);
    return NextResponse.json(
      { error: "Failed to load chart data" },
      { status: 502, headers: { "Cache-Control": "public, max-age=30" } }
    );
  }
}
