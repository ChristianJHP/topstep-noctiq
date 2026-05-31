import type { Metadata } from "next";
import "./radar.css";
import "./market-board.css";

export const metadata: Metadata = {
  title: "Market Radar",
  description:
    "4-step NQ/ES prep: HTF bias, key levels, IFVG confirmation, and execution window.",
};

export default function BiasLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="bias-theme bias-theme--radar min-h-full bg-[var(--background)] text-[var(--foreground)] font-sans">
      {children}
    </div>
  );
}
