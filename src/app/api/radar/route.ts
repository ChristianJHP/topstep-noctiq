import { NextResponse } from "next/server";
import { chartCandlesCacheControl } from "@/lib/chart-cache-config";
import { getRadarPayload } from "@/lib/radar-payload";
import { isFuturesSessionOpen } from "@/lib/futures-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const cacheControl = chartCandlesCacheControl(!isFuturesSessionOpen());

  try {
    const payload = await getRadarPayload();
    return NextResponse.json(payload, {
      headers: { "Cache-Control": cacheControl },
    });
  } catch (error) {
    console.error("[radar]", error);
    return NextResponse.json(
      {
        markets: null,
        nextHighImpact: null,
        redFolderWeek: [],
        calendarSource: null,
        chartCandles: {},
      },
      { status: 503, headers: { "Cache-Control": "public, max-age=30" } }
    );
  }
}
