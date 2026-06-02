"use client";

import { useEffect, useState } from "react";

/** False when the browser tab is in the background — pause heavy polling. */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const sync = () => setVisible(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return visible;
}
