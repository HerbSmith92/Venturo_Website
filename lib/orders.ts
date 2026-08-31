import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { getEventBySlug, getPlatformFees } from "@/lib/events";
import {
  remainingTickets,
  unitPriceCents,
  type EventTicketType,
} from "@/lib/event-types";
import { getPublicSiteUrl } from "@/lib/site-url";

export type CheckoutLine = {
  ticketTypeId: string;
  quantity: number;
};

export async function createTicketOrder(input: {
  userId: string;
  email?: string;
  firstName: string;
  eventSlug: string;
  lines: CheckoutLine[];
  paidMember: boolean;
  origin: string;
}) {
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase is not connected.");

  const event = await getEventBySlug(input.eventSlug);
  if (!event || event.status !== "approved") {
    throw new Error("That event is not on sale.");
  }

  const fees = await getPlatformFees();
  const ticketMap = new Map(event.ticketTypes.map((t) => [t.id, t]));

  let subtotal = 0;
  let listSubtotal = 0;
  const resolved: {
    ticket: EventTicketType;
    quantity: number;
    unit: number;
    lineTotal: number;
  }[] = [];

  for (const line of input.lines) {
    if (line.quantity <= 0) continue;
    const ticket = ticketMap.get(line.ticketTypeId);
    if (!ticket) throw new Error("Unknown ticket type.");
    if (remainingTickets(ticket) < line.quantity) {
      throw new Error(`Not enough ${ticket.name} tickets left.`);
    }
    if (ticket.membersOnly && !input.paidMember) {
      throw new Error(`${ticket.name} is for paid Venturo members.`);
    }
    const unit = unitPriceCents(ticket, input.paidMember);
    const listUnit = ticket.priceCents;
    subtotal += unit * line.quantity;
    listSubtotal += listUnit * line.quantity;
    resolved.push({
      ticket,
      quantity: line.quantity,
      unit,
      lineTotal: unit * line.quantity,
    });
  }

  if (!resolved.length) throw new Error("Choose at least one ticket.");

  const memberDiscount = Math.max(0, listSubtotal - subtotal);
  const commission =
    subtotal > 0 ? Math.round((subtotal * fees.commissionPct) / 100) : 0;
  const bookingFee = subtotal > 0 ? fees.bookingFeeCents : 0;
  // Buyer pays ticket total; platform fees are deducted from organiser payout.
  const total = subtotal;
  const mPaymentId = `evt_${randomUUID().replace(/-/g, "").slice(0, 24)}`;

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
      used_member_pricing: input.paidMember,
      m_payment_id: mPaymentId,
      payout_status: total > 0 ? "pending" : "waived",
    })
    .select("id, m_payment_id, total_cents")
    .single();

  if (error || !order) throw new Error(error?.message ?? "Could not create order.");

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

  if (total === 0) {
    const service = createServiceClient();
    if (!service) throw new Error("Service role is required to issue free tickets.");
    const { error: fulfillError } = await service.rpc("fulfill_event_order", {
      p_order_id: order.id,
      p_payment_id: null,
    });
    if (fulfillError) throw new Error(fulfillError.message);
    return {
      orderId: order.id as string,
      mPaymentId: order.m_payment_id as string,
      totalCents: 0,
      free: true as const,
      redirect: `/account/tickets?order=${order.id}`,
      eventTitle: event.title,
    };
  }

  const publicOrigin = getPublicSiteUrl(input.origin);
  return {
    orderId: order.id as string,
    mPaymentId: order.m_payment_id as string,
    totalCents: total,
    free: false as const,
    eventTitle: event.title,
    returnUrl: `${input.origin}/events/${event.slug}/checkout/return?order=${order.id}`,
    cancelUrl: `${input.origin}/events/${event.slug}?cancelled=1`,
    // ITN must hit production — PayFast cannot notify localhost / preview URLs.
    notifyUrl: `${publicOrigin}/api/payfast/itn`,
  };
}

export async function listBuyerTickets(userId: string) {
  const supabase = await createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("event_tickets")
    .select(
      `
      id, code, created_at, event_id,
      events ( id, slug, title, starts_at, timezone, venue_name, city ),
      event_ticket_types ( id, name )
    `,
    )
    .eq("buyer_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data;
}
