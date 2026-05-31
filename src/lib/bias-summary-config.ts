/** Regenerate AI bias read at most once per this interval while futures are open (seconds). */
export const BIAS_SUMMARY_REVALIDATE_SEC = 20 * 60;

/** Longer cache while futures are closed (weekend, daily break, holidays). */
export const BIAS_SUMMARY_CLOSED_REVALIDATE_SEC = 2 * 60 * 60;

export function biasSummaryCacheControl(marketClosed = false): string {
  const sec = marketClosed
    ? BIAS_SUMMARY_CLOSED_REVALIDATE_SEC
    : BIAS_SUMMARY_REVALIDATE_SEC;
  return `public, s-maxage=${sec}, max-age=${sec}, stale-while-revalidate=300`;
}
