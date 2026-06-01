import { MarketRadar } from "@/components/radar/MarketRadar";
import { CalendarPanel } from "@/components/CalendarPanel";
import { FeedbackBox } from "@/components/radar/FeedbackBox";

export default function BiasPage() {
  return (
    <main className="radar-shell">
      <MarketRadar />

      <div className="mr-details">
        <CalendarPanel />
      </div>

      <FeedbackBox />
    </main>
  );
}
