import { NextResponse } from "next/server";
import {
  attachSourceLinks,
  composeGeopoliticsPayload,
  formatGeopoliticsDeterministic,
  GEO_BRIEF_CLOSED_REVALIDATE_SEC,
  GEO_BRIEF_REVALIDATE_SEC,
  getCachedGeopoliticsBrief,
} from "@/lib/geopolitics-brief";
import { gatherGeopoliticsSources, buildMarketNewsFeed } from "@/lib/geopolitics-sources";
import { isFuturesSessionOpen } from "@/lib/futures-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const marketClosed = !isFuturesSessionOpen();
  const revalidateSec = marketClosed
    ? GEO_BRIEF_CLOSED_REVALIDATE_SEC
    : GEO_BRIEF_REVALIDATE_SEC;

  try {
    const cached = await getCachedGeopoliticsBrief();
    const payload = await composeGeopoliticsPayload({
      ...cached,
      revalidateSec,
    });
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": `public, s-maxage=60, max-age=60, stale-while-revalidate=120`,
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
            text: "Headlines feed unavailable.",
            link: null,
          },
          trump: null,
          expect: {
            text: "Check FinancialJuice manually before trading.",
            link: null,
          },
          markets: "Unknown headline risk — size down until context clears.",
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
