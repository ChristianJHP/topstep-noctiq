const CHART_TZ = "America/New_York";

export type ChartTickMarkKind = "year" | "month" | "day" | "time" | "time-sec";

export function utcSecFromChartTime(time: unknown): number | null {
  if (typeof time === "number" && Number.isFinite(time)) return time;
  return null;
}

/** Crosshair / hover label — date + time in ET. */
export function formatChartEtCrosshair(time: unknown): string {
  const sec = utcSecFromChartTime(time);
  if (sec == null) return "";

  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: CHART_TZ,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(sec * 1000));

  return `${label} ET`;
}

/** X-axis tick labels in ET. */
export function formatChartEtTickMark(
  time: unknown,
  kind: ChartTickMarkKind
): string {
  const sec = utcSecFromChartTime(time);
  if (sec == null) return "";

  if (kind === "year") {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: CHART_TZ,
      year: "numeric",
    }).format(new Date(sec * 1000));
  }

  if (kind === "month") {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: CHART_TZ,
      month: "short",
    }).format(new Date(sec * 1000));
  }

  if (kind === "day") {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: CHART_TZ,
      month: "short",
      day: "numeric",
    }).format(new Date(sec * 1000));
  }

  const opts: Intl.DateTimeFormatOptions = {
    timeZone: CHART_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  };
  if (kind === "time-sec") opts.second = "2-digit";

  return new Intl.DateTimeFormat("en-US", opts).format(new Date(sec * 1000));
}
