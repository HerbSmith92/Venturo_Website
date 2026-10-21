import { NextResponse } from "next/server";
import { confirmPaystackTicket } from "@/lib/paystack-fulfill";
import { bearerToken, userFromBearer } from "@/lib/supabase/bearer";

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Log in to buy tickets." }, { status: 401 });
  }
  const user = await userFromBearer(token);
  if (!user) {
    return NextResponse.json({ error: "Log in to buy tickets." }, { status: 401 });
  }

  const body = (await request.json()) as { orderId?: string };
  const orderId = body.orderId?.trim();
  if (!orderId) {
    return NextResponse.json({ error: "Missing order." }, { status: 400 });
  }

  await confirmPaystackTicket(orderId, user.id);

  const { data: order } = await user.supabase
    .from("event_orders")
    .select("id, status, total_cents, buyer_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.buyer_id !== user.id) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const { data: tickets } = await user.supabase
    .from("event_tickets")
    .select("id, code, event_ticket_types ( name ), events ( title )")
    .eq("order_id", orderId);

  return NextResponse.json({
    status: order.status,
    totalCents: order.total_cents,
    tickets: (tickets ?? []).map((ticket) => {
      const type = Array.isArray(ticket.event_ticket_types)
        ? ticket.event_ticket_types[0]
        : ticket.event_ticket_types;
      const event = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events;
      return {
        id: ticket.id as string,
        code: ticket.code as string,
        name: type?.name ?? "Ticket",
        eventTitle: event?.title ?? "",
      };
    }),
  });
}
