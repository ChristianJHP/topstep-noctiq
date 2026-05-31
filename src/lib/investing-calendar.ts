import type { EconomicEvent } from "@/lib/events";

const INVESTING_URL =
  "https://www.investing.com/economic-calendar/Service/getCalendarFilteredData";

const US_COUNTRY_ID = "5";
const HIGH_IMPORTANCE = "3";
/** Investing.com timezone id for US/Eastern */
const TZ_ET = "8";

function formatYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatTimeEt(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatDayEt(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

/** Parse `2026/05/30 20:30:00` as Eastern wall time */
function parseInvestingDatetime(raw: string): Date {
  const [datePart, timePart] = raw.split(" ");
  const [y, m, d] = datePart.split("/").map(Number);
  const [hh, mm, ss] = timePart.split(":").map(Number);

  const guess = new Date(Date.UTC(y, m - 1, d, hh + 4, mm, ss ?? 0));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(guess)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value])
  );
  const displayed = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  const target = Date.UTC(y, m - 1, d, hh, mm, ss ?? 0);
  return new Date(guess.getTime() + (target - displayed));
}

function parseRows(html: string): EconomicEvent[] {
  const events: EconomicEvent[] = [];
  const rowRe =
    /<tr id="eventRowId_\d+"[^>]*data-event-datetime="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/g;

  let match: RegExpExecArray | null;
  while ((match = rowRe.exec(html)) !== null) {
    const [, datetimeRaw, rowHtml] = match;
    const titleMatch = rowHtml.match(
      /<td class="left event[^"]*"[^>]*>[\s\S]*?<a[^>]*>\s*([^<]+?)\s*<\/a>/i
    );
    if (!titleMatch) continue;

    const title = titleMatch[1].replace(/\s+/g, " ").trim();
    const scheduled = parseInvestingDatetime(datetimeRaw);

    events.push({
      title,
      scheduledAt: scheduled.toISOString(),
      impact: "high",
      timeEt: formatTimeEt(scheduled),
      dayEt: formatDayEt(scheduled),
    });
  }

  return events;
}

export async function fetchInvestingRedFolder(
  withinMs: number
): Promise<EconomicEvent[]> {
  const now = Date.now();
  const start = new Date(now);
  const end = new Date(now + withinMs);

  const body = new URLSearchParams();
  body.set("dateFrom", formatYmd(start));
  body.set("dateTo", formatYmd(end));
  body.append("country[]", US_COUNTRY_ID);
  body.append("importance[]", HIGH_IMPORTANCE);
  body.set("timeZone", TZ_ET);
  body.set("timeFilter", "timeRemain");
  body.set("currentTab", "custom");
  body.set("submitFilters", "1");
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "*/*",
    Origin: "https://www.investing.com",
    Referer: "https://www.investing.com/economic-calendar/",
  };

  const all: EconomicEvent[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < 8; page++) {
    body.set("limit_from", String(page * 20));

    const res = await fetch(INVESTING_URL, {
      method: "POST",
      headers,
      body: body.toString(),
      next: { revalidate: 300 },
    });

    if (!res.ok) throw new Error(`Investing calendar ${res.status}`);

    const json = (await res.json()) as { data?: string };
    const batch = parseRows(json.data ?? "");
    if (batch.length === 0) break;

    for (const e of batch) {
      const key = `${e.title}|${e.scheduledAt}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(e);
    }

    if (batch.length < 20) break;
  }

  return all
    .filter((e) => {
      const t = new Date(e.scheduledAt).getTime();
      return t > now && t <= now + withinMs;
    })
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );
}
