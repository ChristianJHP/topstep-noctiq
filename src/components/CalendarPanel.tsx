"use client";

import useSWR from "swr";
import { formatCountdownHuman } from "@/lib/candle-timers";
import type { EconomicEvent } from "@/lib/events";
import { useCountdownTick } from "@/hooks/use-countdown-tick";

type RadarData = {
  redFolderWeek: EconomicEvent[];
};

export function CalendarPanel() {
  const now = useCountdownTick();
  const { data, isLoading, error } = useSWR<RadarData>(
    "/api/radar",
    (url: string) => fetch(url).then((r) => r.json()),
    { refreshInterval: 120_000 }
  );

  const events = data?.redFolderWeek ?? [];

  if (isLoading) {
    return <p className="text-xs text-[var(--muted)]">Loading…</p>;
  }

  if (error && events.length === 0) {
    return <p className="text-xs text-[var(--muted)]">Unavailable</p>;
  }

  if (events.length === 0) {
    return <p className="text-xs text-[var(--muted)]">No tier-1 events</p>;
  }

  return (
    <ul className="calendar-list">
      {events.map((e) => {
        const ms = new Date(e.scheduledAt).getTime() - now;
        return (
          <li key={`${e.title}-${e.scheduledAt}`} className="calendar-row">
            <span className="calendar-row-title">{e.title}</span>
            <span className="calendar-row-meta">
              {formatCountdownHuman(ms)} · {e.dayEt} {e.timeEt}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
