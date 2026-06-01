import { getZonedParts } from "@/lib/et-time";
import { getMarketSession } from "@/lib/futures-session";
import { formatCountdownHuman } from "@/lib/candle-timers";

const TZ = "America/New_York";

export type TradingSessionLabel =
  | "Closed"
  | "Maintenance"
  | "Asia"
  | "London"
  | "NY AM"
  | "NY Lunch"
  | "NY PM";

export type TradingSessionInfo = {
  label: TradingSessionLabel;
  isMarketOpen: boolean;
  /** Human countdown e.g. "2h 14m until NY AM" */
  countdown: string;
};

type SessionBlock = {
  label: Exclude<TradingSessionLabel, "Closed" | "Maintenance">;
  start: number;
  end: number;
  wrap?: boolean;
};

/** Futures session windows in ET — aligned with briefing / ICT-style splits. */
const SESSION_BLOCKS: SessionBlock[] = [
  { label: "Asia", start: 18 * 60, end: 3 * 60, wrap: true },
  { label: "London", start: 3 * 60, end: 9 * 60 + 30 },
  { label: "NY AM", start: 9 * 60 + 30, end: 12 * 60 },
  { label: "NY Lunch", start: 12 * 60, end: 13 * 60 + 30 },
  { label: "NY PM", start: 13 * 60 + 30, end: 17 * 60 },
];

function etMinutes(now: Date): number {
  const p = getZonedParts(now, TZ);
  return p.hour * 60 + p.minute;
}

function minsInBlock(mins: number, block: SessionBlock): boolean {
  if (block.wrap) {
    return mins >= block.start || mins < block.end;
  }
  return mins >= block.start && mins < block.end;
}

function minutesUntilMinute(target: number, from: number): number {
  if (target > from) return target - from;
  return 24 * 60 - from + target;
}

function currentBlock(mins: number): SessionBlock {
  return (
    SESSION_BLOCKS.find((b) => minsInBlock(mins, b)) ?? SESSION_BLOCKS[0]
  );
}

function nextBlockLabel(current: SessionBlock): string {
  const idx = SESSION_BLOCKS.findIndex((b) => b.label === current.label);
  if (idx < 0 || idx >= SESSION_BLOCKS.length - 1) return "close";
  return SESSION_BLOCKS[idx + 1].label;
}

function minutesUntilBlockEnd(mins: number, block: SessionBlock): number {
  if (block.wrap) {
    if (mins >= block.start) {
      return minutesUntilMinute(block.end, mins);
    }
    return block.end - mins;
  }
  return block.end - mins;
}

function closedLabel(reason: string): TradingSessionLabel {
  if (/maintenance|5-6pm/i.test(reason)) return "Maintenance";
  return "Closed";
}

export function getTradingSessionInfo(now = new Date()): TradingSessionInfo {
  const market = getMarketSession(now);

  if (!market.isOpen) {
    const mins = market.minutesUntilOpen;
    const countdown =
      mins != null
        ? `${formatCountdownHuman(mins * 60_000)} until open`
        : "Until open";
    return {
      label: closedLabel(market.reason),
      isMarketOpen: false,
      countdown,
    };
  }

  const mins = etMinutes(now);
  const block = currentBlock(mins);
  const minsLeft = minutesUntilBlockEnd(mins, block);
  const next = nextBlockLabel(block);

  const countdown =
    next === "close"
      ? `${formatCountdownHuman(minsLeft * 60_000)} until close`
      : `${formatCountdownHuman(minsLeft * 60_000)} until ${next}`;

  // Early close handled by getMarketSession (market not open after 1pm ET)

  return {
    label: block.label,
    isMarketOpen: true,
    countdown,
  };
}
