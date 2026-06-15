import { MarketRadar } from "@/components/radar/MarketRadar";
import { FeedbackBox } from "@/components/radar/FeedbackBox";

export default function BiasPage() {
  return (
    <main className="radar-shell">
      <MarketRadar initialData={null} />
      <FeedbackBox />
    </main>
  );
}
