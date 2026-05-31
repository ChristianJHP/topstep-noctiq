import { NextResponse } from "next/server";
import {
  fetchCalendarMeta,
  pickNextHighImpact,
} from "@/lib/events";
import { computeMarketContext } from "@/lib/htf-status";

export const dynamic = "force-dynamic";

export async function GET() {
  let markets = null;
  let redFolderWeek: Awaited<ReturnType<typeof fetchCalendarMeta>>["events"] =
    [];
  let calendarSource: string | null = null;

  try {
    markets = await computeMarketContext();
  } catch (error) {
    console.error("[radar] markets", error);
  }

  try {
    const cal = await fetchCalendarMeta();
    redFolderWeek = cal.events;
    calendarSource = cal.source;
  } catch (error) {
    console.error("[radar] calendar", error);
  }

  return NextResponse.json({
    markets,
    nextHighImpact: pickNextHighImpact(redFolderWeek),
    redFolderWeek,
    calendarSource,
  });
}
