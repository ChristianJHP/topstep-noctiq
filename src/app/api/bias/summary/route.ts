import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { isAiGatewayConfigured } from "@/lib/ai-gateway";
import { biasSummaryCacheControl } from "@/lib/bias-summary-config";
import { getCachedBiasSummary } from "@/lib/bias-summary";

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get("refresh") === "true";
  const cacheControl = biasSummaryCacheControl();

  if (!isAiGatewayConfigured()) {
    return NextResponse.json(
      { summary: null, configured: false },
      { headers: { "Cache-Control": "public, max-age=60" } }
    );
  }

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

    return NextResponse.json(
      { summary: null, error: "Summary unavailable" },
      {
        status: 503,
        headers: { "Cache-Control": "public, max-age=60" },
      }
    );
  }
}
