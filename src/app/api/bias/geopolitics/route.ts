import { NextResponse } from "next/server";
import {
  formatGeopoliticsDeterministic,
  GEO_BRIEF_CLOSED_REVALIDATE_SEC,
  GEO_BRIEF_REVALIDATE_SEC,
  getCachedGeopoliticsBrief,
} from "@/lib/geopolitics-brief";
import { gatherGeopoliticsSources } from "@/lib/geopolitics-sources";
import { isFuturesSessionOpen } from "@/lib/futures-session";

export async function GET() {
  const marketClosed = !isFuturesSessionOpen();
  const revalidateSec = marketClosed
    ? GEO_BRIEF_CLOSED_REVALIDATE_SEC
    : GEO_BRIEF_REVALIDATE_SEC;

  try {
    const payload = await getCachedGeopoliticsBrief();
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": `public, s-maxage=${revalidateSec}, max-age=${revalidateSec}, stale-while-revalidate=300`,
      },
    });
  } catch (error) {
    console.error("[bias/geopolitics]", error);
    try {
      const sources = await gatherGeopoliticsSources();
      const fallback = formatGeopoliticsDeterministic(sources);
      return NextResponse.json(
        {
          ...fallback,
          generatedAt: new Date().toISOString(),
          configured: false,
          revalidateSec,
          stale: true,
        },
        { headers: { "Cache-Control": "public, max-age=60" } }
      );
    } catch {
      return NextResponse.json(
        {
          war: "Geopolitics feed unavailable.",
          trump: null,
          expect: "Check headlines manually before trading.",
          markets: "Unknown geo impact — size down until context clears.",
          generatedAt: new Date().toISOString(),
          configured: false,
          revalidateSec: 60,
        },
        { status: 503, headers: { "Cache-Control": "public, max-age=60" } }
      );
    }
  }
}
