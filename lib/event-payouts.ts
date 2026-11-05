import {
  addJohannesburgWorkingDays,
  PAYOUT_WORKING_DAYS,
  type EventPayoutRow,
  type EventPayoutSummary,
  type HostPayoutListRow,
} from "@/lib/event-payout-display";
import { hostOwedCents } from "@/lib/overview/metrics";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export {
  addJohannesburgWorkingDays,
  PAYOUT_WORKING_DAYS,
  payoutDueLabel,
  type EventPayoutRow,
  type EventPayoutSummary,
  type HostPayoutListRow,
} from "@/lib/event-payout-display";

const EMPTY: EventPayoutSummary = {
  found: false,
  eventId: "",
  eventTitle: "",
  organiserId: "",
  endsAt: null,
  timezone: "Africa/Johannesburg",
  ended: false,
  dueAt: null,
  due: false,
  overdue: false,
  ticketsBought: 0,
  complimentaryCount: 0,
  freeCount: 0,
  grossCents: 0,
  venturoFeesCents: 0,
  hostKeepCents: 0,
  owedCents: 0,
  paidOutCents: 0,
  waivedCents: 0,
  orders: [],
};

function keepFor(row: {
  subtotalCents: number;
  commissionCents: number;
  bookingFeeCents: number;
  totalCents: number;
}) {
  return hostOwedCents(row);
}

async function db(client?: SupabaseClient | null) {
  if (client) return client;
  return createServiceClient() ?? (await createClient());
}

export async function getEventPayoutSummary(
  eventId: string,
  client?: SupabaseClient | null,
): Promise<EventPayoutSummary> {
  const supabase = await db(client);
  if (!supabase || !eventId) return { ...EMPTY, eventId, found: false };

  const { data: event } = await supabase
    .from("events")
    .select("id, title, organiser_id, ends_at, timezone")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return { ...EMPTY, eventId, found: false };

  const endsAt = typeof event.ends_at === "string" ? event.ends_at : null;
  const ended = Boolean(endsAt && new Date(endsAt).getTime() < Date.now());
  const dueAt = endsAt ? addJohannesburgWorkingDays(endsAt, PAYOUT_WORKING_DAYS).toISOString() : null;
  const due = Boolean(dueAt && new Date(dueAt).getTime() <= Date.now());

  const { data, error } = await supabase
    .from("event_orders")
    .select(
      "id, status, payout_status, subtotal_cents, commission_cents, booking_fee_cents, total_cents, paid_at, refunded_at",
    )
    .eq("event_id", eventId)
    .eq("status", "paid")
    .order("paid_at", { ascending: false });

  if (error || !data) {
    return {
      ...EMPTY,
      found: true,
      eventId,
      eventTitle: event.title ?? "",
      organiserId: event.organiser_id ?? "",
      endsAt,
      timezone: event.timezone || "Africa/Johannesburg",
      ended,
      dueAt,
      due,
    };
  }

  const orders: EventPayoutRow[] = data.map((row) => {
    const subtotalCents = row.subtotal_cents ?? 0;
    const commissionCents = row.commission_cents ?? 0;
    const bookingFeeCents = row.booking_fee_cents ?? 0;
    const totalCents = row.total_cents ?? 0;
    return {
      id: row.id,
      status: row.status,
      payoutStatus: row.payout_status,
      subtotalCents,
      commissionCents,
      bookingFeeCents,
      totalCents,
      hostKeepCents: keepFor({ subtotalCents, commissionCents, bookingFeeCents, totalCents }),
      paidAt: row.paid_at,
    };
  });

  const live = orders.filter((row) => row.status === "paid");
  const sumKeep = (status: string) =>
    live.filter((row) => row.payoutStatus === status).reduce((sum, row) => sum + row.hostKeepCents, 0);

  const hostKeepCents = live.reduce((sum, row) => sum + row.hostKeepCents, 0);
  const grossCents = live.reduce((sum, row) => sum + row.subtotalCents, 0);
  const venturoFeesCents = Math.max(0, grossCents - hostKeepCents);
  const owedCents = sumKeep("owed");

  const orderIds = live.map((row) => row.id);
  let ticketsBought = 0;
  let freeCount = 0;
  if (orderIds.length) {
    const { data: items } = await supabase
      .from("event_order_items")
      .select("order_id, quantity, unit_price_cents, line_total_cents")
      .in("order_id", orderIds);
    if (items?.length) {
      for (const item of items) {
        const qty = Number(item.quantity) || 0;
        const paidLine = (item.line_total_cents ?? 0) > 0 || (item.unit_price_cents ?? 0) > 0;
        if (paidLine) ticketsBought += qty;
        else freeCount += qty;
      }
    } else {
      const { data: paidTickets } = await supabase
        .from("event_tickets")
        .select("id, origin")
        .in("order_id", orderIds);
      for (const ticket of paidTickets ?? []) {
        if (ticket.origin === "complimentary") continue;
        ticketsBought += 1;
      }
    }
  }

  let complimentaryCount = 0;
  const { data: tickets, error: ticketError } = await supabase
    .from("event_tickets")
    .select("id, origin")
    .eq("event_id", eventId);
  if (!ticketError) {
    complimentaryCount = (tickets ?? []).filter((row) => row.origin === "complimentary").length;
  }

  return {
    found: true,
    eventId,
    eventTitle: event.title ?? "",
    organiserId: event.organiser_id ?? "",
    endsAt,
    timezone: event.timezone || "Africa/Johannesburg",
    ended,
    dueAt,
    due,
    overdue: ended && due && owedCents > 0,
    ticketsBought,
    complimentaryCount,
    freeCount,
    grossCents,
    venturoFeesCents,
    hostKeepCents,
    owedCents,
    paidOutCents: sumKeep("paid_out"),
    waivedCents: sumKeep("waived"),
    orders: live,
  };
}

export async function listEndedHostPayouts(): Promise<HostPayoutListRow[]> {
  const supabase = createServiceClient() ?? (await createClient());
  if (!supabase) return [];

  const nowIso = new Date().toISOString();
  const { data: events, error } = await supabase
    .from("events")
    .select("id, title, organiser_id, ends_at, timezone")
    .not("ends_at", "is", null)
    .lt("ends_at", nowIso)
    .order("ends_at", { ascending: false })
    .limit(200);
  if (error || !events?.length) return [];

  const ids = events.map((row) => row.id as string);
  const { data: owed } = await supabase
    .from("event_orders")
    .select("event_id")
    .in("event_id", ids)
    .eq("status", "paid")
    .eq("payout_status", "owed");
  const owedIds = new Set((owed ?? []).map((row) => row.event_id as string));
  const payable = events.filter((row) => owedIds.has(row.id as string));
  if (!payable.length) return [];

  const summaries = await Promise.all(
    payable.map((row) => getEventPayoutSummary(row.id as string, supabase)),
  );
  const rows = summaries.filter((row) => row.owedCents > 0);
  const organiserIds = [...new Set(rows.map((row) => row.organiserId).filter(Boolean))];

  const names = new Map<string, string>();
  const banks = new Map<string, { holder: string; last4: string }>();
  if (organiserIds.length) {
    const [{ data: profiles }, { data: payouts }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, last_name").in("id", organiserIds),
      supabase
        .from("organiser_payout_profiles")
        .select("user_id, account_holder, account_number_last4")
        .in("user_id", organiserIds),
    ]);
    for (const profile of profiles ?? []) {
      names.set(
        profile.id as string,
        [profile.display_name, profile.last_name].filter(Boolean).join(" ").trim() || "Host",
      );
    }
    for (const payout of payouts ?? []) {
      banks.set(payout.user_id as string, {
        holder: payout.account_holder as string,
        last4: payout.account_number_last4 as string,
      });
    }
  }

  return rows.map((row) => {
    const bank = banks.get(row.organiserId);
    return {
      ...row,
      organiserName: names.get(row.organiserId) ?? "Host",
      bankHolder: bank?.holder ?? null,
      bankLast4: bank?.last4 ?? null,
    };
  });
}
