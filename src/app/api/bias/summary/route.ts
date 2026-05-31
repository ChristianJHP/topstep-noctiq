import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { biasSummaryCacheControl } from "@/lib/bias-summary-config";
import {
  formatLineDeterministic,
  getCachedBiasSummary,
} from "@/lib/bias-summary";
import { buildBiasSummaryMarketContext } from "@/lib/bias-summary-context";

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get("refresh") === "true";
  const cacheControl = biasSummaryCacheControl();

  try {
    if (force) {
      revalidateTag("bias-summary", "max");
    }

    const payload = await getCachedBiasSummary();

    return NextResponse.json(
      { ...payload, cached: !force },
      { headers: { "Cache-Control": cacheControl } }
    );
  } catch (error) {
    console.error("[bias/summary]", error);

    try {
      const ctx = await buildBiasSummaryMarketContext();
      return NextResponse.json(
        {
          line: formatLineDeterministic(ctx),
          generatedAt: new Date().toISOString(),
          configured: true,
          stale: true,
        },
        { headers: { "Cache-Control": "public, max-age=60" } }
      );
    } catch {
      return NextResponse.json(
        { line: null, error: "Summary unavailable" },
        {
          status: 503,
          headers: { "Cache-Control": "public, max-age=60" },
        }
      );
    }
  }
}
