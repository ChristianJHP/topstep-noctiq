"use client";

import useSWR from "swr";
import { BIAS_SUMMARY_REVALIDATE_SEC } from "@/lib/bias-summary-config";
import type { SymbolLabel } from "@/lib/strategy-prep";

type LevelsPayload = {
  line: string;
  revalidateSec?: number;
};

export function LevelsSummary({ symbol }: { symbol: SymbolLabel }) {
  const { data, isLoading } = useSWR<LevelsPayload>(
    `/api/bias/levels?symbol=${symbol}`,
    (url: string) => fetch(url).then((r) => r.json()),
    {
      refreshInterval: (latest) =>
        (latest?.revalidateSec ?? BIAS_SUMMARY_REVALIDATE_SEC) * 1000,
      revalidateOnFocus: false,
      dedupingInterval: BIAS_SUMMARY_REVALIDATE_SEC * 1000,
      keepPreviousData: true,
    }
  );

  return (
    <div className="levels-summary" aria-live="polite">
      <span className="levels-summary-k">Brief</span>
      <p className="levels-summary-v">
        {isLoading && !data?.line ? "…" : (data?.line ?? "—")}
      </p>
    </div>
  );
}
