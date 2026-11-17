import "server-only";

import { notifyMemberUsers } from "@/lib/push-notifications";
import { createServiceClient } from "@/lib/supabase/admin";

const HORIZON_MS = 62 * 60 * 60 * 1000;
const HOME = "Africa/Johannesburg";

type DueEvent = {
  id: string;
  title: string;
  starts_at: string;
  venue_name: string | null;
  timezone: string | null;
};

type TicketRow = {
  buyer_id: string | null;
  order_id: string | null;
  event_orders: { status: string } | { status: string }[] | null;
};

export async function sendDueEventReminders() {
  const service = createServiceClient();
  if (!service) return { error: "Service role is not connected.", events: 0, sent: 0 };

  const now = new Date();
  const { data, error } = await service
    .from("events")
    .select("id, title, starts_at, venue_name, timezone")
    .eq("status", "approved")
    .gt("starts_at", now.toISOString())
    .lt("starts_at", new Date(now.getTime() + HORIZON_MS).toISOString())
    .limit(80);
  if (error) return { error: error.message, events: 0, sent: 0 };

  const due = ((data ?? []) as DueEvent[]).filter((event) => {
    const zone = timeZone(event.timezone);
    const tomorrow = addCalendarDay(calendarDate(now, zone));
    return calendarDate(new Date(event.starts_at), zone) === tomorrow;
  });

  let sent = 0;
  for (const event of due) {
    const claimed = await service.from("event_reminder_sends").insert({ event_id: event.id }).select("event_id");
    if (claimed.error || !claimed.data?.length) continue;

    const buyers = await attendeeIds(service, event.id);
    if (!buyers.length) {
      sent += 1;
      continue;
    }

    const delivered = await notifyMemberUsers({
      userIds: buyers,
      title: event.title.trim().slice(0, 80) || "Your event",
      body: reminderBody(event),
      linkPath: `/events/${event.id}`,
      kind: "event",
      id: event.id,
      slug: event.id,
      notice: "remind",
    });
    if (delivered.error) {
      await service.from("event_reminder_sends").delete().eq("event_id", event.id);
      return { error: delivered.error, events: due.length, sent };
    }
    sent += 1;
  }

  return { events: due.length, sent };
}

function reminderBody(event: DueEvent) {
  const zone = timeZone(event.timezone);
  const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(event.starts_at))
    .replace(/[^\d:]/g, "");
  const venue = event.venue_name?.trim();
  const line = venue ? `Tomorrow, ${clock} at ${venue}.` : `Tomorrow, ${clock}.`;
  return line.slice(0, 240);
}

async function attendeeIds(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  eventId: string,
) {
  const { data, error } = await service
    .from("event_tickets")
    .select("buyer_id, order_id, event_orders(status)")
    .eq("event_id", eventId);
  if (error || !data) return [];
  const ids = new Set<string>();
  for (const row of data as TicketRow[]) {
    if (!row.buyer_id) continue;
    const order = Array.isArray(row.event_orders) ? row.event_orders[0] : row.event_orders;
    const admitted = row.order_id == null || order?.status === "paid";
    if (admitted) ids.add(row.buyer_id);
  }
  return [...ids];
}

function timeZone(value: string | null) {
  const name = value?.trim() || HOME;
  try {
    Intl.DateTimeFormat("en-GB", { timeZone: name }).format(new Date());
    return name;
  } catch {
    return HOME;
  }
}

function calendarDate(instant: Date, timeZoneName: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZoneName,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

function addCalendarDay(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}
