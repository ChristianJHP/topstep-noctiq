import Link from "next/link";
import { CalendarPanel } from "@/components/CalendarPanel";
import { MarketMovingHeadlines } from "@/components/MarketMovingHeadlines";
import { RawHeadlinesWidget } from "@/components/RawHeadlinesWidget";
import { RadarAccordion } from "@/components/RadarAccordion";
import { RadarTopCard } from "@/components/RadarTopCard";

export default function BiasPage() {
  return (
    <main className="radar-shell flex flex-col gap-2 py-2">
      <div className="flex items-center justify-between px-1 pb-1">
        <Link
          href="/"
          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          ← jhptrades.com
        </Link>
      </div>
      <RadarTopCard />

      <RadarAccordion title="Market-moving headlines" defaultOpen>
        <MarketMovingHeadlines />
      </RadarAccordion>

      <RadarAccordion title="Red folder calendar">
        <CalendarPanel />
      </RadarAccordion>

      <RadarAccordion title="Raw headlines">
        <RawHeadlinesWidget />
      </RadarAccordion>
    </main>
  );
}
