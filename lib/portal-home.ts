import { listAccessibleEvents } from "@/lib/events";
import { PORTAL_SANDBOX_DAYS, PORTAL_SANDBOX_SLUG } from "@/lib/portal-sandbox";
import { createClient } from "@/lib/supabase/server";
import type { VenturoEvent } from "@/lib/event-types";

export const PORTAL_RANGES = ["month", "90d", "year"] as const;
export type PortalRange = (typeof PORTAL_RANGES)[number];

export const PORTAL_RANGE_LABELS: Record<PortalRange, string> = {
  month: "Month",
  "90d": "Last 3 Months",
  year: "Year",
};

const ZONE = "Africa/Johannesburg";

export function parsePortalRange(raw?: string): PortalRange {
  if (raw === "90d" || raw === "year" || raw === "month") return raw;
  return "month";
}

export function johannesburgDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function shiftDay(day: string, delta: number) {
  const [year, month, date] = day.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, date + delta));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

function daysInclusive(start: string, end: string) {
  const days: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(cursor);
    cursor = shiftDay(cursor, 1);
    if (days.length > 400) break;
  }
  return days;
}

/** SAST is UTC+2 year-round. */
function sastStartIso(day: string) {
  return `${day}T00:00:00+02:00`;
}

function rangeWindow(range: PortalRange, now = new Date()) {
  const today = johannesburgDay(now);
  const [year, month] = today.split("-").map(Number);
  let start = today;
  if (range === "month") start = `${year}-${pad(month)}-01`;
  else if (range === "year") start = `${year}-01-01`;
  else start = shiftDay(today, -89);

  return {
    startDay: start,
    endDay: today,
    startIso: sastStartIso(start),
    endIso: now.toISOString(),
    days: daysInclusive(start, today),
  };
}

export type DayPoint = { day: string; value: number };

export type EventHomeSeries = {
  event: VenturoEvent;
  viewed: number;
  sold: number;
  revenueCents: number;
  conversion: number;
  viewedSeries: DayPoint[];
  soldSeries: DayPoint[];
  revenueSeries: DayPoint[];
};

export type PortalHomeData = {
  range: PortalRange;
  ticketsSold: number;
  views: number;
  revenueCents: number;
  events: EventHomeSeries[];
};

function isActiveEvent(event: VenturoEvent, now = Date.now()) {
  if (event.status === "cancelled" || event.status === "rejected") return false;
  if (event.endsAt) {
    const end = new Date(event.endsAt).getTime();
    if (!Number.isNaN(end) && end < now) return false;
  }
  return true;
}

function emptySeries(days: string[]): DayPoint[] {
  return days.map((day) => ({ day, value: 0 }));
}

function fillSeries(days: string[], byDay: Map<string, number>): DayPoint[] {
  return days.map((day) => ({ day, value: byDay.get(day) ?? 0 }));
}

type DayMaps = {
  views: Map<string, number>;
  sold: Map<string, number>;
  revenue: Map<string, number>;
};

function bump(map: Map<string, number>, day: string, amount: number) {
  map.set(day, (map.get(day) ?? 0) + amount);
}

function sumMap(map: Map<string, number>) {
  let total = 0;
  for (const value of map.values()) total += value;
  return total;
}

function applySunriseSandbox(
  events: VenturoEvent[],
  byEvent: Map<string, DayMaps>,
  window: { startDay: string; endDay: string },
  mapsFor: (eventId: string) => DayMaps,
) {
  const hiked = events.find((event) => event.slug === PORTAL_SANDBOX_SLUG);
  if (!hiked) {
    return { views: 0, sold: 0, revenueCents: 0, replaced: { views: 0, sold: 0, revenueCents: 0 } };
  }

  const existing = byEvent.get(hiked.id);
  const replaced = {
    views: existing ? sumMap(existing.views) : 0,
    sold: existing ? sumMap(existing.sold) : 0,
    revenueCents: existing ? sumMap(existing.revenue) : 0,
  };

  const maps = mapsFor(hiked.id);
  maps.views.clear();
  maps.sold.clear();
  maps.revenue.clear();

  let views = 0;
  let sold = 0;
  let revenueCents = 0;
  for (const row of PORTAL_SANDBOX_DAYS) {
    const day = shiftDay(window.endDay, -row.ago);
    if (day < window.startDay || day > window.endDay) continue;
    bump(maps.views, day, row.views);
    bump(maps.sold, day, row.sold);
    bump(maps.revenue, day, row.revenueCents);
    views += row.views;
    sold += row.sold;
    revenueCents += row.revenueCents;
  }

  return { views, sold, revenueCents, replaced };
}

export async function getPortalHome(
  organiserId: string,
  range: PortalRange,
): Promise<PortalHomeData> {
  const window = rangeWindow(range);
  const allEvents = await listAccessibleEvents(organiserId);
  const active = allEvents
    .filter((event) => isActiveEvent(event))
    .sort((a, b) => {
      if (!a.startsAt && !b.startsAt) return a.title.localeCompare(b.title);
      if (!a.startsAt) return 1;
      if (!b.startsAt) return -1;
      return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    });

  const blankEvent = (event: VenturoEvent): EventHomeSeries => ({
    event,
    viewed: 0,
    sold: 0,
    revenueCents: 0,
    conversion: 0,
    viewedSeries: emptySeries(window.days),
    soldSeries: emptySeries(window.days),
    revenueSeries: emptySeries(window.days),
  });

  const empty: PortalHomeData = {
    range,
    ticketsSold: 0,
    views: 0,
    revenueCents: 0,
    events: active.map(blankEvent),
  };

  const ids = allEvents.map((event) => event.id);
  if (!ids.length) return empty;

  const supabase = await createClient();
  if (!supabase) return empty;

  const [viewsRes, ticketsRes, ordersRes] = await Promise.all([
    supabase
      .from("event_view_days")
      .select("event_id, day, views")
      .in("event_id", ids)
      .gte("day", window.startDay)
      .lte("day", window.endDay),
    supabase
      .from("event_tickets")
      .select("event_id, created_at")
      .in("event_id", ids)
      .gte("created_at", window.startIso)
      .lte("created_at", window.endIso),
    supabase
      .from("event_orders")
      .select("event_id, subtotal_cents, paid_at")
      .in("event_id", ids)
      .eq("status", "paid")
      .gte("paid_at", window.startIso)
      .lte("paid_at", window.endIso),
  ]);

  const byEvent = new Map<string, DayMaps>();
  const mapsFor = (eventId: string) => {
    let row = byEvent.get(eventId);
    if (!row) {
      row = { views: new Map(), sold: new Map(), revenue: new Map() };
      byEvent.set(eventId, row);
    }
    return row;
  };

  let viewsTotal = 0;
  for (const row of viewsRes.data ?? []) {
    const day = String(row.day);
    const count = Number(row.views) || 0;
    viewsTotal += count;
    bump(mapsFor(row.event_id).views, day, count);
  }

  let soldTotal = 0;
  for (const row of ticketsRes.data ?? []) {
    const day = johannesburgDay(new Date(row.created_at));
    if (day < window.startDay || day > window.endDay) continue;
    soldTotal += 1;
    bump(mapsFor(row.event_id).sold, day, 1);
  }

  let revenueTotal = 0;
  for (const row of ordersRes.data ?? []) {
    if (!row.paid_at) continue;
    const day = johannesburgDay(new Date(row.paid_at));
    if (day < window.startDay || day > window.endDay) continue;
    const cents = Number(row.subtotal_cents) || 0;
    revenueTotal += cents;
    bump(mapsFor(row.event_id).revenue, day, cents);
  }

  const sandbox = applySunriseSandbox(allEvents, byEvent, window, mapsFor);
  viewsTotal += sandbox.views - sandbox.replaced.views;
  soldTotal += sandbox.sold - sandbox.replaced.sold;
  revenueTotal += sandbox.revenueCents - sandbox.replaced.revenueCents;

  return {
    range,
    ticketsSold: soldTotal,
    views: viewsTotal,
    revenueCents: revenueTotal,
    events: active.map((event) => {
      const maps = byEvent.get(event.id);
      const viewedSeries = fillSeries(window.days, maps?.views ?? new Map());
      const soldSeries = fillSeries(window.days, maps?.sold ?? new Map());
      const revenueSeries = fillSeries(window.days, maps?.revenue ?? new Map());
      const viewed = viewedSeries.reduce((sum, point) => sum + point.value, 0);
      const sold = soldSeries.reduce((sum, point) => sum + point.value, 0);
      const revenueCents = revenueSeries.reduce((sum, point) => sum + point.value, 0);
      return {
        event,
        viewed,
        sold,
        revenueCents,
        conversion: viewed > 0 ? (sold / viewed) * 100 : 0,
        viewedSeries,
        soldSeries,
        revenueSeries,
      };
    }),
  };
}
