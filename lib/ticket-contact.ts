import { createServiceClient } from "@/lib/supabase/admin";

/** Copy the buyer's name, email & cellphone onto tickets that were issued blank. */
export async function stampTicketContact(orderId: string) {
  const service = createServiceClient();
  if (!service) return;

  const { data: order } = await service
    .from("event_orders")
    .select("buyer_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order?.buyer_id) return;

  const [{ data: profile }, { data: userData }] = await Promise.all([
    service
      .from("profiles")
      .select("display_name, last_name, phone")
      .eq("id", order.buyer_id)
      .maybeSingle(),
    service.auth.admin.getUserById(order.buyer_id),
  ]);

  const name = [profile?.display_name, profile?.last_name].filter(Boolean).join(" ").trim();
  const phone = profile?.phone?.trim() || "";
  const email = userData.user?.email?.trim() || "";
  if (!name && !phone && !email) return;

  const { data: tickets } = await service
    .from("event_tickets")
    .select("id, guest_name, guest_email, guest_phone")
    .eq("order_id", orderId);

  for (const ticket of tickets ?? []) {
    const patch: { guest_name?: string; guest_email?: string; guest_phone?: string } = {};
    if (!ticket.guest_name?.trim() && name) patch.guest_name = name;
    if (!ticket.guest_email?.trim() && email) patch.guest_email = email;
    if (!ticket.guest_phone?.trim() && phone) patch.guest_phone = phone;
    if (!Object.keys(patch).length) continue;
    await service.from("event_tickets").update(patch).eq("id", ticket.id);
  }
}
