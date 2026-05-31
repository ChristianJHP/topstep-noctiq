"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type RadarAccordionProps = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

export function RadarAccordion({
  title,
  children,
  defaultOpen = false,
}: RadarAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="radar-card mr-accordion overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mr-accordion-btn flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-white/90">{title}</span>
        <span
          className={cn(
            "text-[var(--muted)] transition-transform",
            open && "rotate-180"
          )}
        >
          ▾
        </span>
      </button>
      {open ? (
        <div className="border-t border-[var(--border)] px-3 pb-3">{children}</div>
      ) : null}
    </div>
  );
}
