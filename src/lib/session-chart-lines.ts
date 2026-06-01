import type { OhlcBar } from "@/lib/ohlc-aggregate";
import type { ChartPlotLine } from "@/lib/market-analysis";
import { currentSessionHighLow } from "@/lib/session-levels";

const SESSION_LINE_COLOR = "rgba(148, 163, 184, 0.28)";

export function sessionLinesForBars(
  bars: OhlcBar[],
  now = new Date()
): ChartPlotLine[] {
  const sess = currentSessionHighLow(bars, now);
  if (!sess || !Number.isFinite(sess.high) || !Number.isFinite(sess.low)) {
    return [];
  }

  const tag = sess.label.replace("NY ", "");

  return [
    {
      price: sess.high,
      color: SESSION_LINE_COLOR,
      style: "dashed",
      label: `${tag} H`,
      role: "session",
    },
    {
      price: sess.low,
      color: SESSION_LINE_COLOR,
      style: "dashed",
      label: `${tag} L`,
      role: "session",
    },
  ];
}
