"use client";

import useSWR from "swr";
import {
  type GeoBriefField,
} from "@/lib/geopolitics-brief";

type GeoBrief = {
  war: GeoBriefField;
  trump: GeoBriefField | null;
  expect: GeoBriefField;
  markets: string;
  revalidateSec?: number;
};

function GeoLink({ field, className }: { field: GeoBriefField; className: string }) {
  if (field.link) {
    return (
      <a
        href={field.link}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className} geo-v--link`}
        title="Open source"
      >
        {field.text}
      </a>
    );
  }
  return <p className={className}>{field.text}</p>;
}

export function GeopoliticsStrip() {
  const { data, isLoading } = useSWR<GeoBrief>(
    "/api/bias/geopolitics",
    (url: string) => fetch(url).then((r) => r.json()),
    {
      refreshInterval: 60_000,
      revalidateOnFocus: true,
      dedupingInterval: 30_000,
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
        <span className="geo-k">Now</span>
        <GeoLink field={data.war} className="geo-v" />
      </div>
      {data.trump ? (
        <div className="geo-strip-row">
          <span className="geo-k">Trump</span>
          <GeoLink field={data.trump} className="geo-v geo-v--trump" />
        </div>
      ) : null}
      <div className="geo-strip-row">
        <span className="geo-k">Watch</span>
        <GeoLink field={data.expect} className="geo-v" />
      </div>
    </section>
  );
}
