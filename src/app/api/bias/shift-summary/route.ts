import { NextResponse } from "next/server";
import {
  generateBiasShiftSummary,
  type BiasShiftItem,
  type ShiftSymbolSnapshot,
} from "@/lib/bias-shift-summary";
import type { SymbolLabel } from "@/lib/strategy-prep";

export const dynamic = "force-dynamic";

type ShiftSummaryBody = {
  shifts?: BiasShiftItem[];
  symbols?: Partial<Record<SymbolLabel, ShiftSymbolSnapshot>>;
  esNqAligned?: boolean;
  smt?: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ShiftSummaryBody;
    const shifts = body.shifts ?? [];

    if (shifts.length === 0) {
      return NextResponse.json(
        { line: null, error: "No shifts" },
        { status: 400 }
      );
    }

    const payload = await generateBiasShiftSummary({
      shifts,
      symbols: body.symbols ?? {},
      esNqAligned: body.esNqAligned ?? false,
      smt: body.smt ?? null,
    });

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[bias/shift-summary]", error);
    return NextResponse.json(
      { line: null, error: "Summary unavailable" },
      { status: 503 }
    );
  }
}
