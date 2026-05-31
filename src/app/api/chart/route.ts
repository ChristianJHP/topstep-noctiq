import { NextRequest, NextResponse } from "next/server";
import { fetchCandles } from "@/lib/chart-data";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker");
  if (!ticker) {
    return NextResponse.json({ error: "Missing ticker" }, { status: 400 });
  }

  try {
    const candles = await fetchCandles(ticker);
    return NextResponse.json({ candles });
  } catch (error) {
    console.error("[chart]", error);
    return NextResponse.json(
      { error: "Failed to load chart data" },
      { status: 502 }
    );
  }
}
