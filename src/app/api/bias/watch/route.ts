import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { biasSummaryCacheControl } from "@/lib/bias-summary-config";
import { isFuturesSessionOpen } from "@/lib/futures-session";
import {
  formatWatchDeterministic,
  getCachedBiasWatch,
} from "@/lib/bias-watch";
import { buildBiasSummaryMarketContext } from "@/lib/bias-summary-context";

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get("refresh") === "true";
  const marketClosed = !isFuturesSessionOpen();
  const cacheControl = biasSummaryCacheControl(marketClosed);

  try {
    if (force) {
      revalidateTag("bias-watch", "max");
    }

    const payload = await getCachedBiasWatch();

    return NextResponse.json(
      { ...payload, cached: !force },
      { headers: { "Cache-Control": cacheControl } }
    );
  } catch (error) {
    console.error("[bias/watch]", error);

    try {
      const ctx = await buildBiasSummaryMarketContext();
      return NextResponse.json(
        {
          items: formatWatchDeterministic(ctx),
          generatedAt: new Date().toISOString(),
          configured: true,
          stale: true,
        },
        { headers: { "Cache-Control": "public, max-age=60" } }
      );
    } catch {
      return NextResponse.json(
        { items: [], error: "Watch list unavailable" },
        {
          status: 503,
          headers: { "Cache-Control": "public, max-age=60" },
        }
      );
    }
  }
}
