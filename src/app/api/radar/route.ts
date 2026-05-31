import { NextResponse } from "next/server";
import {
  fetchCalendarMeta,
  pickNextHighImpact,
} from "@/lib/events";
import { computeMarketContext } from "@/lib/htf-status";
import { loadAllChartCandles } from "@/lib/chart-candles-cache";
import { chartCandlesCacheControl } from "@/lib/chart-cache-config";
import { isFuturesSessionOpen } from "@/lib/futures-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const cacheControl = chartCandlesCacheControl(!isFuturesSessionOpen());

  const [marketsResult, calResult, charts] = await Promise.allSettled([
    computeMarketContext(),
    fetchCalendarMeta(),
    loadAllChartCandles(),
  ]);

  const markets =
    marketsResult.status === "fulfilled" ? marketsResult.value : null;
  if (marketsResult.status === "rejected") {
    console.error("[radar] markets", marketsResult.reason);
  }

  let redFolderWeek: Awaited<ReturnType<typeof fetchCalendarMeta>>["events"] =
    [];
  let calendarSource: string | null = null;
  if (calResult.status === "fulfilled") {
    redFolderWeek = calResult.value.events;
    calendarSource = calResult.value.source;
  } else {
    console.error("[radar] calendar", calResult.reason);
  }

  const chartCandles =
    charts.status === "fulfilled" ? charts.value : {};
  if (charts.status === "rejected") {
    console.error("[radar] charts", charts.reason);
  }

  return NextResponse.json(
    {
      markets,
      nextHighImpact: pickNextHighImpact(redFolderWeek),
      redFolderWeek,
      calendarSource,
      chartCandles,
    },
    { headers: { "Cache-Control": cacheControl } }
  );
}
