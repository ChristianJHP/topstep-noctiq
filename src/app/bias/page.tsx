import { MarketRadar } from "@/components/radar/MarketRadar";
import { CalendarPanel } from "@/components/CalendarPanel";

export default function BiasPage() {
  return (
    <main className="radar-shell">
      <MarketRadar />

      <div className="mr-details">
        <CalendarPanel />
      </div>
    </main>
  );
}
