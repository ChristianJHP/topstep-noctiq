import { MarketRadar } from "@/components/radar/MarketRadar";
import { CalendarPanel } from "@/components/CalendarPanel";
import { FeedbackBox } from "@/components/radar/FeedbackBox";
import { getRadarPayload } from "@/lib/radar-payload";

export const dynamic = "force-dynamic";

export default async function BiasPage() {
  let initialRadar = null;
  try {
    initialRadar = await getRadarPayload();
  } catch (error) {
    console.error("[bias/page] radar preload failed", error);
  }

  return (
    <main className="radar-shell">
      <MarketRadar initialData={initialRadar} />

      <div className="mr-details">
        <CalendarPanel initialRadar={initialRadar} />
      </div>

      <FeedbackBox />
    </main>
  );
}
