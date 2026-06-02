import type { Metadata } from "next";
import "./radar.css";
import "./market-board.css";

export const metadata: Metadata = {
  title: "Market Context",
  description:
    "NQ/ES/Gold context, levels, charts, and catalyst feed for futures prep.",
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
