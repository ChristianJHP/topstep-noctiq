import { NextResponse } from "next/server";
import { fetchHeadlinesMeta } from "@/lib/headlines";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await fetchHeadlinesMeta();
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[headlines]", error);
    return NextResponse.json(
      {
        marketMoving: [],
        raw: [],
        source: "none",
        error: "unavailable",
      },
      { status: 502 }
    );
  }
}
