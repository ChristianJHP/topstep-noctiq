import { NextResponse } from "next/server";
import {
  attachSourceLinks,
  composeGeopoliticsPayload,
  formatGeopoliticsDeterministic,
  GEO_BRIEF_CLOSED_REVALIDATE_SEC,
  GEO_BRIEF_REVALIDATE_SEC,
  getCachedGeopoliticsBrief,
  getFreshGeopoliticsBrief,
} from "@/lib/geopolitics-brief";
import { gatherGeopoliticsSources, buildMarketNewsFeed, buildContextFeed } from "@/lib/geopolitics-sources";
import { isFuturesSessionOpen } from "@/lib/futures-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const fresh = new URL(request.url).searchParams.get("fresh") === "1";
  const marketClosed = !isFuturesSessionOpen();
  const revalidateSec = marketClosed
    ? GEO_BRIEF_CLOSED_REVALIDATE_SEC
    : GEO_BRIEF_REVALIDATE_SEC;

  if (fresh) {
    try {
      const payload = await getFreshGeopoliticsBrief();
      return NextResponse.json(
        { ...payload, revalidateSec },
        { headers: { "Cache-Control": "no-store" } }
      );
    } catch (error) {
      console.error("[bias/geopolitics fresh]", error);
    }
  }

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
      const feed = buildMarketNewsFeed(sources);
      return NextResponse.json(
        {
          ...attachSourceLinks(strings, sources),
          feed,
          contextFeed: buildContextFeed(feed, sources.headlines),
          headlines: sources.headlines,
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
          contextFeed: [],
          headlines: [],
          generatedAt: new Date().toISOString(),
          configured: false,
          revalidateSec: 60,
        },
        { status: 503, headers: { "Cache-Control": "public, max-age=60" } }
      );
    }
  }
}
