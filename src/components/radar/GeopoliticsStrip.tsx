"use client";

import useSWR from "swr";
import { GEO_BRIEF_REVALIDATE_SEC } from "@/lib/geopolitics-brief";

type GeoBrief = {
  war: string;
  trump: string | null;
  expect: string;
  markets: string;
  revalidateSec?: number;
};

export function GeopoliticsStrip() {
  const { data, isLoading } = useSWR<GeoBrief>(
    "/api/bias/geopolitics",
    (url: string) => fetch(url).then((r) => r.json()),
    {
      refreshInterval: (latest) =>
        (latest?.revalidateSec ?? GEO_BRIEF_REVALIDATE_SEC) * 1000,
      revalidateOnFocus: false,
      dedupingInterval: GEO_BRIEF_REVALIDATE_SEC * 1000,
    }
  );

  if (isLoading && !data) {
    return (
      <section className="geo-strip geo-strip--loading" aria-label="Geopolitics">
        <p className="geo-strip-muted">Loading geo context…</p>
      </section>
    );
  }

  if (!data) return null;

  return (
    <section className="geo-strip" aria-label="Geopolitics brief">
      <div className="geo-strip-row">
        <span className="geo-k">War</span>
        <p className="geo-v">{data.war}</p>
      </div>
      {data.trump ? (
        <div className="geo-strip-row">
          <span className="geo-k">Trump</span>
          <p className="geo-v geo-v--trump">{data.trump}</p>
        </div>
      ) : null}
      <div className="geo-strip-row">
        <span className="geo-k">Watch</span>
        <p className="geo-v">{data.expect}</p>
      </div>
    </section>
  );
}
