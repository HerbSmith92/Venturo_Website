"use server";

import { requireAdmin } from "@/lib/auth";
import { getEventPayoutSummary } from "@/lib/event-payouts";
import { createServiceClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function markEventPayoutPaid(formData: FormData) {
  const session = await requireAdmin();
  const eventId = String(formData.get("eventId") ?? "").trim();
  if (!eventId) redirect("/admin/payouts");

  const service = createServiceClient();
  if (!service) redirect(`/admin/payouts/${eventId}?error=${encodeURIComponent("Service role is not connected.")}`);

  const before = await getEventPayoutSummary(eventId, service);
  const { data, error } = await service
    .from("event_orders")
    .update({ payout_status: "paid_out" })
    .eq("event_id", eventId)
    .eq("status", "paid")
    .eq("payout_status", "owed")
    .select("id");
  if (error) redirect(`/admin/payouts/${eventId}?error=${encodeURIComponent(error.message)}`);

  await service.from("event_audit_events").insert({
    event_id: eventId,
    actor_id: session.id,
    action: "payout_paid_out",
    after: {
      owed_cents: before.owedCents,
      order_ids: (data ?? []).map((row) => row.id),
      marked_at: new Date().toISOString(),
    },
  });

  revalidatePath("/admin/payouts");
  revalidatePath(`/admin/payouts/${eventId}`);
  revalidatePath(`/portal/events/${eventId}/payment`);
  redirect(`/admin/payouts/${eventId}?done=paid`);
}
