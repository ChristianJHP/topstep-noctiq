"use client";

import { useEffect, useId } from "react";
import { mountFinancialJuiceWidget } from "@/lib/load-financialjuice-widgets";

export function RawHeadlinesWidget() {
  const reactId = useId();
  const containerId = `fj-raw-headlines-${reactId.replace(/:/g, "")}`;

  useEffect(() => {
    mountFinancialJuiceWidget({
      container: containerId,
      widgetType: "NEWS",
      mode: "Dark",
      height: "360px",
      backColor: "#181b22",
      fontColor: "#e8eaed",
    }).catch(() => {
      const el = document.getElementById(containerId);
      if (el) {
        el.innerHTML =
          '<p style="font-size:12px;color:#8b939e;padding:8px">FinancialJuice widget unavailable</p>';
      }
    });
  }, [containerId]);

  return (
    <div
      id={containerId}
      className="fj-widget-body min-h-[200px] overflow-hidden rounded-sm bg-[#14171c]"
    />
  );
}
