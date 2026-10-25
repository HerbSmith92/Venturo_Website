import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  compareAttention,
  hostOwedCents,
  isTestEmail,
  johannesburgDateKey,
  johannesburgDayStart,
  percentDelta,
  previousRange,
  resolveRange,
  uniqueIds,
  venturoFeeCents,
} from "../lib/overview/metrics.ts";

test("last 7 days starts six Johannesburg midnights ago", () => {
  const now = new Date("2026-10-25T08:00:00.000Z");
  const range = resolveRange({ range: "7d" }, now);
  assert.equal(range.key, "7d");
  assert.equal(johannesburgDateKey(range.start), "2026-10-19");
  assert.equal(johannesburgDateKey(range.end), "2026-10-25");
  const today = resolveRange({}, now);
  assert.equal(today.key, "7d");
});

test("today follows Johannesburg midnight, not UTC", () => {
  const now = new Date("2026-10-25T00:30:00.000Z");
  const range = resolveRange({ range: "today" }, now);
  assert.equal(johannesburgDateKey(range.start), "2026-10-25");
  assert.equal(range.start.toISOString(), johannesburgDayStart(now).toISOString());
});

test("previous period is the same length immediately before", () => {
  const now = new Date("2026-10-25T10:00:00.000Z");
  const range = resolveRange({ range: "7d" }, now);
  const previous = previousRange(range);
  assert.equal(previous.end.getTime(), range.start.getTime() - 1);
  assert.equal(previous.end.getTime() - previous.start.getTime(), range.end.getTime() - range.start.getTime());
});

test("custom dates swap when the end is before the start", () => {
  const now = new Date("2026-10-25T10:00:00.000Z");
  const range = resolveRange({ range: "custom", from: "2026-10-20", to: "2026-10-18" }, now);
  assert.equal(johannesburgDateKey(range.start), "2026-10-18");
  assert.equal(johannesburgDateKey(range.end), "2026-10-20");
});

test("signed-in users are counted once across platforms", () => {
  assert.equal(uniqueIds(["a", "a", "b", null, undefined]), 2);
});

test("test emails match the database exclusion rules", () => {
  assert.equal(isTestEmail("test@venturo.co.za"), true);
  assert.equal(isTestEmail("herb+test@venturo.co.za"), true);
  assert.equal(isTestEmail("person@example.com"), true);
  assert.equal(isTestEmail("herb@venturo.co.za"), false);
});

test("host owed keeps fees that were passed to the buyer", () => {
  assert.equal(
    hostOwedCents({ subtotalCents: 10_000, commissionCents: 500, bookingFeeCents: 200, totalCents: 10_700 }),
    10_000,
  );
  assert.equal(
    hostOwedCents({ subtotalCents: 10_000, commissionCents: 500, bookingFeeCents: 200, totalCents: 10_000 }),
    9_300,
  );
  assert.equal(venturoFeeCents({ commissionCents: 500, bookingFeeCents: 200 }), 700);
});

test("comparisons stay finite when the previous period is zero", () => {
  assert.equal(percentDelta(0, 0), "0% vs previous period");
  assert.equal(percentDelta(4, 0), "No earlier baseline");
  assert.equal(percentDelta(12, 10), "+20% vs previous period");
});

test("attention puts customer access ahead of older content queues", () => {
  const ordered = [
    { severity: "low" as const, ageHours: 100 },
    { severity: "critical" as const, ageHours: 1 },
    { severity: "high" as const, ageHours: 5 },
  ].sort(compareAttention);
  assert.deepEqual(
    ordered.map((item) => item.severity),
    ["critical", "high", "low"],
  );
});

test("adding days does not drift the Johannesburg date key", () => {
  const start = johannesburgDayStart(new Date("2026-10-25T21:00:00.000Z"));
  assert.equal(johannesburgDateKey(addDays(start, 1)), "2026-10-26");
});
