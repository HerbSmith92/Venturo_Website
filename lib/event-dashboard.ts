import { formatCents } from "@/lib/events";
import { johannesburgDay, type DayPoint } from "@/lib/portal-home";
import { createClient } from "@/lib/supabase/server";
import type { VenturoEvent } from "@/lib/event-types";

export type EventDashboardData = {
  incomeCents: number;
  ticketsSold: number;
  visits: number;
  conversion: number;
  viewedSeries: DayPoint[];
  soldSeries: DayPoint[];
  revenueSeries: DayPoint[];
};

function emptySeries(days: number): DayPoint[] {
  const today = johannesburgDay();
  const [year, month, date] = today.split("-").map(Number);
  const points: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const next = new Date(Date.UTC(year, month - 1, date - i));
    const day = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
    points.push({ day, value: 0 });
  }
  return points;
}

export async function getEventDashboard(event: VenturoEvent): Promise<EventDashboardData> {
  const series = emptySeries(30);
  const blank: EventDashboardData = {
    incomeCents: 0,
    ticketsSold: 0,
    visits: 0,
    conversion: 0,
    viewedSeries: series,
    soldSeries: series.map((point) => ({ ...point })),
    revenueSeries: series.map((point) => ({ ...point })),
  };

  const supabase = await createClient();
  if (!supabase) return blank;

  const startDay = series[0]?.day;
  const endDay = series[series.length - 1]?.day;
  if (!startDay || !endDay) return blank;

  const [viewsRes, ticketsRes, ordersRes, lifetimeViews, lifetimeTickets, lifetimeOrders] =
    await Promise.all([
      supabase
        .from("event_view_days")
        .select("day, views")
        .eq("event_id", event.id)
        .gte("day", startDay)
        .lte("day", endDay),
      supabase.from("event_tickets").select("created_at").eq("event_id", event.id),
      supabase
        .from("event_orders")
        .select("subtotal_cents, paid_at, status")
        .eq("event_id", event.id)
        .eq("status", "paid"),
      supabase.from("event_view_days").select("views").eq("event_id", event.id),
      supabase.from("event_tickets").select("id", { count: "exact", head: true }).eq("event_id", event.id),
      supabase
        .from("event_orders")
        .select("subtotal_cents")
        .eq("event_id", event.id)
        .eq("status", "paid"),
    ]);

  const viewMap = new Map<string, number>();
  for (const row of viewsRes.data ?? []) {
    viewMap.set(String(row.day), Number(row.views) || 0);
  }
  const soldMap = new Map<string, number>();
  for (const row of ticketsRes.data ?? []) {
    const day = johannesburgDay(new Date(row.created_at));
    soldMap.set(day, (soldMap.get(day) ?? 0) + 1);
  }
  const revenueMap = new Map<string, number>();
  for (const row of ordersRes.data ?? []) {
    if (!row.paid_at) continue;
    const day = johannesburgDay(new Date(row.paid_at));
    revenueMap.set(day, (revenueMap.get(day) ?? 0) + (Number(row.subtotal_cents) || 0));
  }

  const visits = (lifetimeViews.data ?? []).reduce((sum, row) => sum + (Number(row.views) || 0), 0);
  const ticketsSold = lifetimeTickets.count ?? (ticketsRes.data ?? []).length;
  const incomeCents = (lifetimeOrders.data ?? []).reduce(
    (sum, row) => sum + (Number(row.subtotal_cents) || 0),
    0,
  );

  return {
    incomeCents,
    ticketsSold,
    visits,
    conversion: visits > 0 ? (ticketsSold / visits) * 100 : 0,
    viewedSeries: series.map((point) => ({ day: point.day, value: viewMap.get(point.day) ?? 0 })),
    soldSeries: series.map((point) => ({ day: point.day, value: soldMap.get(point.day) ?? 0 })),
    revenueSeries: series.map((point) => ({
      day: point.day,
      value: revenueMap.get(point.day) ?? 0,
    })),
  };
}

export function formatDashboardRate(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0%";
  if (n >= 100) return "100%";
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded)) return `${rounded}%`;
  return `${rounded.toFixed(2)}%`;
}

export function formatDashboardMoney(cents: number) {
  return formatCents(cents);
}
