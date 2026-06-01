import { NextResponse } from "next/server";
import {
  attachSourceLinks,
  formatGeopoliticsDeterministic,
  GEO_BRIEF_CLOSED_REVALIDATE_SEC,
  GEO_BRIEF_REVALIDATE_SEC,
  getCachedGeopoliticsBrief,
} from "@/lib/geopolitics-brief";
import { gatherGeopoliticsSources, buildMarketNewsFeed } from "@/lib/geopolitics-sources";
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
      const strings = formatGeopoliticsDeterministic(sources);
      return NextResponse.json(
        {
          ...attachSourceLinks(strings, sources),
          feed: buildMarketNewsFeed(sources),
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
          war: {
            text: "Geopolitics feed unavailable.",
            link: null,
          },
          trump: null,
          expect: {
            text: "Check headlines manually before trading.",
            link: null,
          },
          markets: "Unknown geo impact — size down until context clears.",
          feed: [],
          generatedAt: new Date().toISOString(),
          configured: false,
          revalidateSec: 60,
        },
        { status: 503, headers: { "Cache-Control": "public, max-age=60" } }
      );
    }
  }
}
