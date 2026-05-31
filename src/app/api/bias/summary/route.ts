import { NextResponse } from "next/server";
import { generateText } from "ai";
import { fetchCalendarMeta, pickNextHighImpact } from "@/lib/events";
import { fetchHeadlinesMeta } from "@/lib/headlines";
import type { MarketContext } from "@/lib/htf-status";
import { computeMarketContext } from "@/lib/htf-status";

export const dynamic = "force-dynamic";

const CACHE_MS = 20 * 60 * 1000;

let cache: {
  summary: string | null;
  generatedAt: string | null;
  expiresAt: number | null;
} = {
  summary: null,
  generatedAt: null,
  expiresAt: null,
};

function fmtSymbol(s: MarketContext["nq"]) {
  return `${s.label} ${s.current} | 4H ${s.fourHour.colorLabel} | 1H ${s.oneHour.colorLabel} | ${s.expansion} | 4H H ${s.h4High} L ${s.h4Low} (${s.distances.toH4High}pt from 4H high)`;
}

function buildPrompt(
  markets: MarketContext,
  nextEvent: ReturnType<typeof pickNextHighImpact>,
  headlines: string[]
) {
  const lines = [
    "NQ & ES futures context (America/New_York):",
    fmtSymbol(markets.nq),
    fmtSymbol(markets.es),
    `Relative strength: ${markets.relativeStrength.headline}`,
  ];

  if (markets.smt) {
    lines.push(`SMT: ${markets.smt.message}`);
  }

  if (nextEvent) {
    lines.push(
      `Next macro: ${nextEvent.title} at ${nextEvent.dayEt} ${nextEvent.timeEt} ET`
    );
  } else {
    lines.push("Next macro: none on calendar this week");
  }

  if (headlines.length) {
    lines.push("Headlines:");
    headlines.slice(0, 5).forEach((h) => lines.push(`- ${h}`));
  }

  return `You write short futures tape reads for NQ/ES day traders.

${lines.join("\n")}

Write exactly 2 short sentences (max 55 words total).
Sentence 1: current 4H/1H structure and which index is relatively stronger.
Sentence 2: what matters for RTH (levels, expansion, or next macro headline if relevant).

Rules:
- Plain text only. No markdown, bullets, or labels.
- Only use numbers and facts from the data above.
- Sound like a trader talking to another trader, not marketing copy.
- Do not say "bias board", "actionable", "navigate", or "landscape".`;
}

export async function GET(request: Request) {
  const now = Date.now();
  const force = new URL(request.url).searchParams.get("refresh") === "true";

  if (
    !force &&
    cache.summary &&
    cache.expiresAt &&
    now < cache.expiresAt
  ) {
    return NextResponse.json({
      summary: cache.summary,
      generatedAt: cache.generatedAt,
      cached: true,
    });
  }

  if (!process.env.AI_GATEWAY_API_KEY) {
    return NextResponse.json({ summary: null, configured: false });
  }

  try {
    const [markets, cal, headlinesPayload] = await Promise.all([
      computeMarketContext(),
      fetchCalendarMeta(),
      fetchHeadlinesMeta(),
    ]);

    const nextEvent = pickNextHighImpact(cal.events);
    const headlines = headlinesPayload.marketMoving.map((h) => h.title);

    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt: buildPrompt(markets, nextEvent, headlines),
      maxOutputTokens: 120,
    });

    const summary = text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();

    cache = {
      summary,
      generatedAt: new Date().toISOString(),
      expiresAt: now + CACHE_MS,
    };

    return NextResponse.json({
      summary,
      generatedAt: cache.generatedAt,
      cached: false,
    });
  } catch (error) {
    console.error("[bias/summary]", error);

    if (cache.summary) {
      return NextResponse.json({
        summary: cache.summary,
        generatedAt: cache.generatedAt,
        cached: true,
        stale: true,
      });
    }

    return NextResponse.json(
      { summary: null, error: "Summary unavailable" },
      { status: 503 }
    );
  }
}
