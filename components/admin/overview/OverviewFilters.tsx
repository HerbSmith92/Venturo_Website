"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export function OverviewFilters({
  range,
  platform,
  from,
  to,
  loadedAt,
}: {
  range: string;
  platform: string;
  from: string;
  to: string;
  loadedAt: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  function push(next: { range?: string; platform?: string; from?: string; to?: string }) {
    const params = new URLSearchParams();
    const nextRange = next.range ?? range;
    params.set("range", nextRange);
    params.set("platform", next.platform ?? platform);
    if (nextRange === "custom") {
      params.set("from", next.from ?? customFrom);
      params.set("to", next.to ?? customTo);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const updated = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(loadedAt));

  return (
    <div className="ops-filters">
      <label>
        <span className="sr-only">Reporting period</span>
        <select value={range} onChange={(event) => push({ range: event.target.value })}>
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      {range === "custom" ? (
        <form
          className="ops-custom"
          onSubmit={(event) => {
            event.preventDefault();
            push({ range: "custom", from: customFrom, to: customTo });
          }}
        >
          <label>
            <span className="sr-only">From</span>
            <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} required />
          </label>
          <label>
            <span className="sr-only">To</span>
            <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} required />
          </label>
          <button type="submit">Apply</button>
        </form>
      ) : null}
      <label>
        <span className="sr-only">Platform</span>
        <select value={platform} onChange={(event) => push({ platform: event.target.value })}>
          <option value="all">All platforms</option>
          <option value="web">Website</option>
          <option value="ios">iOS</option>
          <option value="android">Android</option>
        </select>
      </label>
      <p>Updated {updated} SAST</p>
    </div>
  );
}
