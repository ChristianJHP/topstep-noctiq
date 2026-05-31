import type { Metadata } from "next";
import "./radar.css";

export const metadata: Metadata = {
  title: "Daily Bias",
  description: "NQ & ES daily bias — 4H/1H structure, levels, and macro context.",
};

export default function BiasLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="bias-theme min-h-full bg-[var(--background)] text-[var(--foreground)] font-sans">
      {children}
    </div>
  );
}
