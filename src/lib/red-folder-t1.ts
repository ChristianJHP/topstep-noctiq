import type { EconomicEvent } from "@/lib/events";

/** Prop-firm style tier-1 (red folder) — not every high-impact PMI/Oil/etc. */
const T1_MATCHERS: { test: (title: string) => boolean; label: string }[] = [
  {
    test: (t) =>
      /nonfarm payroll|nonfarm employment|average hourly earnings|unemployment rate|employment situation|u\.?s\.? employment/i.test(
        t
      ) && !/adp|jolts|jobless claims/i.test(t),
    label: "U.S. Employment Report",
  },
  {
    test: (t) =>
      /\bcpi\b|consumer price index|core inflation/i.test(t) &&
      !/ppi|pce|import price/i.test(t),
    label: "CPI",
  },
  {
    test: (t) =>
      /fomc statement|fomc press conference|fomc meeting|federal funds rate|fed interest rate decision/i.test(
        t
      ) && !/member|speaks|speech|testimony/i.test(t),
    label: "FOMC Meeting",
  },
];

function t1Label(title: string): string | null {
  for (const m of T1_MATCHERS) {
    if (m.test(title)) return m.label;
  }
  return null;
}

function slotKey(e: EconomicEvent): string {
  return `${e.scheduledAt.slice(0, 16)}`;
}

/** Collapse duplicate releases (NFP + unemployment + AHE → one Employment line). */
/** Speeches / PMI / oil etc. are high-impact but not red-folder tier 1. */
export function isRedFolderT1Title(title: string): boolean {
  return t1Label(title) !== null;
}

export function pickNextRedFolder(events: EconomicEvent[]): EconomicEvent | null {
  return filterRedFolderT1(events)[0] ?? null;
}

export function filterRedFolderT1(events: EconomicEvent[]): EconomicEvent[] {
  const bySlot = new Map<string, EconomicEvent>();

  for (const e of events) {
    const label = t1Label(e.title);
    if (!label) continue;

    const key = `${slotKey(e)}|${label}`;
    const existing = bySlot.get(key);
    if (!existing) {
      bySlot.set(key, { ...e, title: label });
      continue;
    }
    if (new Date(e.scheduledAt).getTime() < new Date(existing.scheduledAt).getTime()) {
      bySlot.set(key, { ...e, title: label });
    }
  }

  return [...bySlot.values()].sort(
    (a, b) =>
      new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );
}

function formatEtHm(totalMinutes: number): string {
  const wrapped = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  const h12 = h % 12 || 12;
  const ampm = h < 12 ? "AM" : "PM";
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

/** 2 minutes before/after event (prop-firm no-trade window). */
export function formatNoTradeWindow(timeEt: string): string {
  const [hh, mm] = timeEt.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return "";
  const center = hh * 60 + mm;
  return `No trades or orders between ${formatEtHm(center - 2)} and ${formatEtHm(center + 2)}`;
}
