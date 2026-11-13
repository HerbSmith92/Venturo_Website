"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export function AnalyticsRangeFilters({
  range,
  from,
  to,
}: {
  range: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  function push(next: { range?: string; from?: string; to?: string }) {
    const params = new URLSearchParams();
    const nextRange = next.range ?? range;
    params.set("range", nextRange);
    if (nextRange === "custom") {
      params.set("from", next.from ?? customFrom);
      params.set("to", next.to ?? customTo);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="ops-filters">
      <label>
        <span className="sr-only">Reporting period</span>
        <select value={range} onChange={(event) => push({ range: event.target.value })}>
          <option value="7d">Last 7 days</option>
          <option value="30d">Month</option>
          <option value="90d">3 months</option>
          <option value="365d">Year</option>
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
            <input
              type="date"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
              required
            />
          </label>
          <label>
            <span className="sr-only">To</span>
            <input
              type="date"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
              required
            />
          </label>
          <button type="submit">Apply</button>
        </form>
      ) : null}
    </div>
  );
}
