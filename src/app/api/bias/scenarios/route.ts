import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { biasSummaryCacheControl } from "@/lib/bias-summary-config";
import {
  formatScenariosDeterministic,
  getCachedBiasScenarios,
} from "@/lib/bias-scenarios";
import { buildBiasScenariosContext } from "@/lib/bias-summary-context";

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get("refresh") === "true";
  const cacheControl = biasSummaryCacheControl();

  try {
    if (force) {
      revalidateTag("bias-scenarios", "max");
    }

    const payload = await getCachedBiasScenarios();

    return NextResponse.json(
      { ...payload, cached: !force },
      { headers: { "Cache-Control": cacheControl } }
    );
  } catch (error) {
    console.error("[bias/scenarios]", error);

    try {
      const ctx = await buildBiasScenariosContext();
      return NextResponse.json(
        {
          scenarios: formatScenariosDeterministic(ctx),
          generatedAt: new Date().toISOString(),
          configured: true,
          stale: true,
        },
        { headers: { "Cache-Control": "public, max-age=60" } }
      );
    } catch {
      return NextResponse.json(
        { scenarios: null, error: "Scenarios unavailable" },
        {
          status: 503,
          headers: { "Cache-Control": "public, max-age=60" },
        }
      );
    }
  }
}
