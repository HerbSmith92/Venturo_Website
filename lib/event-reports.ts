import "server-only";

import { sendVenturoEmail } from "@/lib/email-delivery";
import { getEventPayoutSummary } from "@/lib/event-payouts";
import { getPublicSiteUrl } from "@/lib/site-url";
import { createServiceClient } from "@/lib/supabase/admin";

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function zonedParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day"), hour: read("hour"), minute: read("minute") };
}

function zonedDateTimeUtc(
  input: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string,
) {
  const guess = Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute);
  const seen = zonedParts(new Date(guess), timeZone);
  const represented = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
  return new Date(guess - (represented - guess));
}

function shiftLocalDay(parts: ReturnType<typeof zonedParts>, days: number) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function eventDayReportDueAt(startsAt: string, timezone: string, localTime = "07:00") {
  const start = new Date(startsAt);
  const local = zonedParts(start, timezone);
  const early = local.hour < 10;
  const day = shiftLocalDay(local, early ? -1 : 0);
  const [configuredHour, configuredMinute] = localTime.split(":").map(Number);
  return zonedDateTimeUtc(
    {
      ...day,
      hour: early ? 18 : (Number.isFinite(configuredHour) ? configuredHour : 7),
      minute: early ? 0 : (Number.isFinite(configuredMinute) ? configuredMinute : 0),
    },
    timezone,
  );
}

export async function generateEventDayReport(occurrenceId: string) {
  const service = createServiceClient();
  if (!service) throw new Error("Service role is not connected.");
  const { data: occurrence, error } = await service
    .from("event_occurrences")
    .select("id, event_id, starts_at, timezone, events(id, title, organiser_id, host_report_local_time)")
    .eq("id", occurrenceId)
    .maybeSingle();
  if (error || !occurrence) throw new Error(error?.message || "Occurrence not found.");
  const event = one(occurrence.events as {
    id: string;
    title: string;
    organiser_id: string;
    host_report_local_time: string;
  } | Array<{ id: string; title: string; organiser_id: string; host_report_local_time: string }> | null);
  if (!event) throw new Error("Event not found.");

  const [{ data: tickets }, { data: interests }, { data: latest }] = await Promise.all([
    service
      .from("event_tickets")
      .select("id, buyer_id, guest_name, guest_email, code, event_orders!inner(id, status, booking_source)")
      .eq("occurrence_id", occurrence.id)
      .eq("event_orders.status", "paid"),
    service
      .from("event_occurrence_interest")
      .select("user_id")
      .eq("event_id", occurrence.event_id)
      .eq("occurrence_starts_at", occurrence.starts_at),
    service
      .from("event_day_reports")
      .select("version")
      .eq("occurrence_id", occurrence.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const confirmedUsers = new Set<string>();
  let rsvps = 0;
  let validTickets = 0;
  for (const ticket of tickets ?? []) {
    if (ticket.buyer_id) confirmedUsers.add(ticket.buyer_id);
    const order = one(ticket.event_orders as { booking_source: string } | Array<{ booking_source: string }> | null);
    if (order?.booking_source === "free_rsvp") rsvps += 1;
    else validTickets += 1;
  }
  const interestedRows = (interests ?? []).filter((row) => !confirmedUsers.has(row.user_id));
  const version = (latest?.version ?? 0) + 1;
  const snapshot = {
    generatedAt: new Date().toISOString(),
    tickets: tickets ?? [],
    interested: interestedRows,
  };
  const { data: report, error: insertError } = await service
    .from("event_day_reports")
    .insert({
      occurrence_id: occurrence.id,
      version,
      timezone: occurrence.timezone,
      confirmed_rsvps: rsvps,
      valid_tickets: validTickets,
      interested: interestedRows.length,
      expected_attendance: rsvps + validTickets,
      snapshot,
    })
    .select("id, generated_at")
    .single();
  if (insertError || !report) throw new Error(insertError?.message || "Could not save report.");

  try {
    const { data: owner } = await service.auth.admin.getUserById(event.organiser_id);
    if (!owner.user?.email) throw new Error("Host has no email.");
    const href = `${getPublicSiteUrl()}/portal/events/${event.id}/report`;
    await sendVenturoEmail({
      to: owner.user.email,
      subject: `${event.title} · event-day report`,
      heading: "Your event-day report",
      body: `${rsvps} free RSVP${rsvps === 1 ? "" : "s"}, ${validTickets} valid ticket${validTickets === 1 ? "" : "s"} & ${interestedRows.length} interested. Expected attendance: ${rsvps + validTickets}. Generated ${new Date(report.generated_at).toLocaleString("en-ZA", { timeZone: occurrence.timezone, hourCycle: "h23" })}.`,
      href,
      cta: "Open live guest list",
    });
    await service.from("event_day_reports").update({ email_status: "sent" }).eq("id", report.id);
  } catch (caught) {
    await service.from("event_day_reports").update({ email_status: "failed" }).eq("id", report.id);
    throw caught;
  }
  return { reportId: report.id, expectedAttendance: rsvps + validTickets };
}

export async function generateDueEventDayReports(now = new Date()) {
  const service = createServiceClient();
  if (!service) return { error: "Service role is not connected.", generated: 0 };
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const { data, error } = await service
    .from("event_occurrences")
    .select("id, starts_at, timezone, events(host_report_local_time)")
    .eq("status", "scheduled")
    .gt("starts_at", now.toISOString())
    .lte("starts_at", horizon.toISOString());
  if (error) return { error: error.message, generated: 0 };
  let generated = 0;
  for (const occurrence of data ?? []) {
    const event = one(occurrence.events as { host_report_local_time: string } | Array<{ host_report_local_time: string }> | null);
    const due = eventDayReportDueAt(occurrence.starts_at, occurrence.timezone, event?.host_report_local_time ?? "07:00");
    if (due.getTime() > now.getTime() || due.getTime() < now.getTime() - 10 * 60 * 1000) continue;
    const { data: existing } = await service
      .from("event_day_reports")
      .select("id")
      .eq("occurrence_id", occurrence.id)
      .limit(1)
      .maybeSingle();
    if (existing) continue;
    try {
      await generateEventDayReport(occurrence.id);
      generated += 1;
    } catch (caught) {
      console.error("[event day report]", caught instanceof Error ? caught.message : caught);
    }
  }
  return { generated };
}

export async function recalculateEventFinancials(eventId: string) {
  const service = createServiceClient();
  if (!service) throw new Error("Service role is not connected.");
  const summary = await getEventPayoutSummary(eventId, service);
  if (!summary.found) throw new Error("Event not found.");
  const [{ data: adjustments }, { data: activeCases }, { data: latest }] = await Promise.all([
    service.from("event_adjustments").select("amount_cents").eq("event_id", eventId),
    service.from("event_cases").select("id").eq("event_id", eventId).in("status", ["open", "investigating"]),
    service
      .from("event_financial_statements")
      .select("version, totals")
      .eq("event_id", eventId)
      .eq("audience", "host")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const adjustmentCents = (adjustments ?? []).reduce((sum, row) => sum + Number(row.amount_cents || 0), 0);
  const payableCents = Math.max(0, summary.owedCents + adjustmentCents);
  const totals = {
    grossCents: summary.grossCents,
    refundCents: 0,
    feeCents: summary.venturoFeesCents,
    adjustmentCents,
    payableCents,
    ticketCount: summary.ticketsBought,
    complimentaryCount: summary.complimentaryCount,
    freeCount: summary.freeCount,
    provisional: true,
  };
  const unchanged = latest?.totals && JSON.stringify(latest.totals) === JSON.stringify(totals);
  const version = unchanged ? latest.version : (latest?.version ?? 0) + 1;
  if (!unchanged) {
    await service.from("event_financial_statements").insert([
      { event_id: eventId, version, status: "provisional", audience: "host", totals },
      { event_id: eventId, version, status: "provisional", audience: "venturo", totals },
    ]);
  }

  let dueDate: string | null = null;
  if (summary.endsAt) {
    const localDay = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Johannesburg",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(summary.endsAt));
    const { data } = await service.rpc("add_za_working_days", { p_from: localDay, p_days: 2 });
    dueDate = data ?? null;
  }
  const held = (activeCases?.length ?? 0) > 0;
  await service.from("event_payouts").upsert(
    {
      event_id: eventId,
      status: held ? "held" : dueDate && dueDate <= new Date().toISOString().slice(0, 10) ? "eligible" : "provisional",
      due_date: dueDate,
      gross_cents: summary.grossCents,
      fee_cents: summary.venturoFeesCents,
      adjustment_cents: adjustmentCents,
      payable_cents: payableCents,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id" },
  );
  return { version, totals, dueDate, held };
}

export async function recalculateDueEventFinancials(now = new Date()) {
  const service = createServiceClient();
  if (!service) return { error: "Service role is not connected.", recalculated: 0 };
  const { data, error } = await service
    .from("events")
    .select("id")
    .lt("ends_at", now.toISOString())
    .gte("ends_at", new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString())
    .in("status", ["approved", "cancelled"]);
  if (error) return { error: error.message, recalculated: 0 };
  let recalculated = 0;
  for (const event of data ?? []) {
    try {
      await recalculateEventFinancials(event.id);
      recalculated += 1;
    } catch (caught) {
      console.error("[event financials]", caught instanceof Error ? caught.message : caught);
    }
  }
  return { recalculated };
}
