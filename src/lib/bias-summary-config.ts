/** Poll live quote while futures are open (ms). */
export const LIVE_QUOTE_REFRESH_MS = 4_000;

/** Poll news/catalyst feed while open (ms). */
export const LIVE_NEWS_REFRESH_MS = 30_000;

/** Regenerate AI bias at most once per this interval while futures are open (seconds). */
export const BIAS_SUMMARY_REVALIDATE_SEC = 30 * 60;

/** Fast deterministic refresh after a volatile move (seconds). */
export const BIAS_SUMMARY_REACTION_REVALIDATE_SEC = 60;

/** Longer cache while futures are closed (weekend, daily break, holidays). */
export const BIAS_SUMMARY_CLOSED_REVALIDATE_SEC = 2 * 60 * 60;

export function biasSummaryCacheControl(marketClosed = false): string {
  const sec = marketClosed
    ? BIAS_SUMMARY_CLOSED_REVALIDATE_SEC
    : BIAS_SUMMARY_REVALIDATE_SEC;
  return `public, s-maxage=${sec}, max-age=${sec}, stale-while-revalidate=300`;
}
