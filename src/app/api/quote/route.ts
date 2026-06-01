import { NextRequest, NextResponse } from "next/server";
import { MARKET_TICKERS } from "@/lib/chart-data";
import { fetchYahooLiveQuote } from "@/lib/yahoo-live-quote";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ticker =
    request.nextUrl.searchParams.get("ticker") ?? MARKET_TICKERS.NQ;

  try {
    const quote = await fetchYahooLiveQuote(ticker);
    return NextResponse.json(quote, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[quote]", error);
    return NextResponse.json(
      { error: "Quote unavailable" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
