/** Regenerate AI bias read at most once per this interval (seconds). */
export const BIAS_SUMMARY_REVALIDATE_SEC = 20 * 60;

export function biasSummaryCacheControl(): string {
  return `public, s-maxage=${BIAS_SUMMARY_REVALIDATE_SEC}, max-age=${BIAS_SUMMARY_REVALIDATE_SEC}, stale-while-revalidate=300`;
}
