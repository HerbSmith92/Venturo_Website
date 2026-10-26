import { newPaystackReference, PAYSTACK_WEBHOOK_PATH } from "@/lib/paystack";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTicketEmail } from "@/lib/ticket-email";
import { stampTicketContact } from "@/lib/ticket-contact";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { getEventBySlug, getPlatformFees } from "@/lib/events";
import { listOccurrences, parseRepeat } from "@/lib/event-repeat";
import { checkoutBuyerShare } from "@/lib/event-fees";
import {
  remainingTickets,
  unitPriceCents,
  type EventTicketType,
} from "@/lib/event-types";
import { recordMemberActivity, type ActivityPlatform } from "@/lib/member-activity";
import { getPublicSiteUrl } from "@/lib/site-url";

export type CheckoutLine = {
  ticketTypeId: string;
  quantity: number;
};

export type TicketOrderResult = {
  orderId: string;
  mPaymentId: string;
  totalCents: number;
  eventTitle: string;
  eventSlug: string;
  joinAndBuy: boolean;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
} & ({ free: true; redirect: string } | { free: false });

export async function createTicketOrder(input: {
  userId: string;
  email?: string;
  firstName: string;
  eventSlug: string;
  lines: CheckoutLine[];
  paidMember: boolean;
  origin: string;
  promoCode?: string;
  inviteToken?: string;
  occurrenceStartsAt?: string;
  occurrenceEndsAt?: string;
  /** Paystack returns into the iOS app instead of the website account. */
  appCheckout?: boolean;
  activityPlatform?: ActivityPlatform;
}, client?: SupabaseClient): Promise<TicketOrderResult> {
  const supabase = client ?? (await createClient());
  if (!supabase) throw new Error("Supabase is not connected.");

  const event = await getEventBySlug(input.eventSlug);
  if (!event || event.status !== "approved") {
    throw new Error("That event is not on sale.");
  }

  const fees = await getPlatformFees();
  const ticketMap = new Map(event.ticketTypes.map((t) => [t.id, t]));
  const occurrences = listOccurrences(event.startsAt, event.endsAt, event.repeatEvery, event.repeatUntil);
  const repeating = parseRepeat(event.repeatEvery) != null;
  let occurrenceStarts: string | null = null;
  let occurrenceEnds: string | null = null;
  if (repeating) {
    const wanted = input.occurrenceStartsAt ? new Date(input.occurrenceStartsAt).getTime() : Number.NaN;
    const match = occurrences.find((item) => Math.abs(new Date(item.startsAt).getTime() - wanted) < 1000);
    if (!match) throw new Error("Choose a date that is still on.");
    occurrenceStarts = match.startsAt;
    occurrenceEnds = match.endsAt;
  } else if (occurrences[0]) {
    occurrenceStarts = occurrences[0].startsAt;
    occurrenceEnds = occurrences[0].endsAt;
  }
  const soldForDate = occurrenceStarts
    ? await ticketsSoldForOccurrence(event.id, occurrenceStarts)
    : null;

  const picked: { ticket: EventTicketType; quantity: number }[] = [];
  for (const line of input.lines) {
    if (line.quantity <= 0) continue;
    const ticket = ticketMap.get(line.ticketTypeId);
    if (!ticket || !ticket.listed) throw new Error("That ticket is not on sale.");
    const sold = soldForDate ? (soldForDate.get(ticket.id) ?? 0) : ticket.soldCount;
    const left = ticket.quantity - sold;
    if (left < line.quantity || remainingTickets({ ...ticket, soldCount: sold }) < line.quantity) {
      throw new Error(`Not enough ${ticket.name} tickets left.`);
    }
    picked.push({ ticket, quantity: line.quantity });
  }

  if (!picked.length) throw new Error("Choose at least one ticket.");

  const joinAndBuy =
    !input.paidMember && picked.some((line) => line.ticket.membersOnly);
  const priceAsMember = input.paidMember || joinAndBuy;

  let subtotal = 0;
  let listSubtotal = 0;
  const resolved = picked.map((line) => {
    const unit = unitPriceCents(line.ticket, priceAsMember, fees.memberDiscountPct);
    const lineTotal = unit * line.quantity;
    subtotal += lineTotal;
    listSubtotal += line.ticket.priceCents * line.quantity;
    return {
      ticket: line.ticket,
      quantity: line.quantity,
      unit,
      lineTotal,
    };
  });

  const memberDiscount = Math.max(0, listSubtotal - subtotal);
  const share = checkoutBuyerShare(
    resolved.map((line) => ({
      ticket: line.ticket,
      quantity: line.quantity,
      unitCents: line.unit,
    })),
    fees,
  );
  const commission = share.commission;
  const bookingFee = share.booking;
  let total = share.total;
  let promoCodeId: string | null = null;
  const code = (input.promoCode ?? "").trim().toUpperCase();
  if (code) {
    try {
      const { data: promo } = await supabase
        .from("event_promo_codes")
        .select("id, kind, value")
        .eq("event_id", event.id)
        .eq("code", code)
        .maybeSingle();
      if (!promo) throw new Error("That promo code is not on this event.");
      promoCodeId = promo.id;
      if (promo.kind === "percent") {
        const pct = Number(promo.value) || 0;
        total = Math.max(0, Math.round(total * (1 - pct / 100)));
      } else if (promo.kind === "amount") {
        const off = Math.round((Number(promo.value) || 0) * 100);
        total = Math.max(0, total - off);
      }
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("promo code")) throw caught;
      // Table may not be applied yet.
    }
  }
  const mPaymentId = newPaystackReference("evt");
  let inviteId: string | null = null;
  const inviteToken = (input.inviteToken ?? "").trim();
  if (inviteToken) {
    const admin = createServiceClient();
    if (admin) {
      const { data: invite } = await admin
        .from("event_invites")
        .select("id, event_id, status, complimentary, kind")
        .eq("token", inviteToken)
        .maybeSingle();
      if (
        invite &&
        invite.event_id === event.id &&
        !invite.complimentary &&
        invite.kind !== "rsvp" &&
        (invite.status === "pending" || invite.status === "opened")
      ) {
        inviteId = invite.id as string;
      }
    }
  }

  const { data: order, error } = await supabase
    .from("event_orders")
    .insert({
      event_id: event.id,
      buyer_id: input.userId,
      status: "pending",
      subtotal_cents: subtotal,
      member_discount_cents: memberDiscount,
      commission_cents: commission,
      booking_fee_cents: bookingFee,
      total_cents: total,
      used_member_pricing: priceAsMember,
      m_payment_id: mPaymentId,
      payout_status: total > 0 ? "pending" : "waived",
      promo_code_id: promoCodeId,
      invite_id: inviteId,
      occurrence_starts_at: occurrenceStarts,
      occurrence_ends_at: occurrenceEnds,
    })
    .select("id, m_payment_id, total_cents")
    .single();

  if (error || !order) throw new Error(error?.message ?? "Could not create order.");
  await recordMemberActivity(
    input.userId,
    "checkout",
    input.activityPlatform ?? (input.appCheckout ? "unknown" : "web"),
  );

  const { error: itemsError } = await supabase.from("event_order_items").insert(
    resolved.map((line) => ({
      order_id: order.id,
      ticket_type_id: line.ticket.id,
      quantity: line.quantity,
      unit_price_cents: line.unit,
      line_total_cents: line.lineTotal,
    })),
  );
  if (itemsError) throw new Error(itemsError.message);

  const publicOrigin = getPublicSiteUrl(input.origin);
  const urls = {
    orderId: order.id as string,
    mPaymentId: order.m_payment_id as string,
    totalCents: total,
    eventTitle: event.title,
    eventSlug: event.slug,
    joinAndBuy,
    returnUrl: input.appCheckout
      ? `${publicOrigin}/events/${event.slug}/checkout/app?order=${order.id}`
      : `${input.origin}/events/${event.slug}/checkout/return?order=${order.id}`,
    cancelUrl: `${input.origin}/events/${event.slug}?cancelled=1`,
    notifyUrl: `${publicOrigin}${PAYSTACK_WEBHOOK_PATH}`,
  };

  // Join & buy waits on the membership ITN, even when tickets themselves are free.
  if (total === 0 && !joinAndBuy) {
    const service = createServiceClient();
    if (!service) throw new Error("Service role is required to issue free tickets.");
    const { error: fulfillError } = await service.rpc("fulfill_event_order", {
      p_order_id: order.id,
      p_payment_id: null,
    });
    if (fulfillError) throw new Error(fulfillError.message);
    await stampTicketContact(order.id);
    await sendTicketEmail(order.id);
    return {
      ...urls,
      free: true,
      redirect: `/account/tickets?order=${order.id}`,
    };
  }

  return {
    ...urls,
    free: false,
  };
}

export async function ticketsSoldForOccurrence(eventId: string, startsAt: string) {
  const service = createServiceClient() ?? (await createClient());
  const counts = new Map<string, number>();
  if (!service) return counts;
  const { data, error } = await service
    .from("event_tickets")
    .select("ticket_type_id")
    .eq("event_id", eventId)
    .eq("occurrence_starts_at", startsAt);
  if (error || !data) return counts;
  for (const row of data) {
    const id = String(row.ticket_type_id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export async function listBuyerTickets(userId: string) {
  const supabase = await createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("event_tickets")
    .select(
      `
      id, code, created_at, order_id, event_id, occurrence_starts_at, occurrence_ends_at,
      events (
        id, slug, title, starts_at, ends_at, timezone,
        venue_name, address_line1, city, latitude, longitude, status,
        banner_url, listing_image_url, story_image_url
      ),
      event_ticket_types ( id, name )
    `,
    )
    .eq("buyer_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data;
}
