"use server";

import { requireAdmin } from "@/lib/auth";
import { sendVenturoEmail } from "@/lib/email-delivery";
import { getEventPayoutSummary } from "@/lib/event-payouts";
import { formatCents } from "@/lib/event-types";
import { getPublicSiteUrl } from "@/lib/site-url";
import { createServiceClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function markEventPayoutPaid(formData: FormData) {
  const session = await requireAdmin();
  const eventId = String(formData.get("eventId") ?? "").trim();
  const paymentReference = String(formData.get("paymentReference") ?? "").trim();
  if (!eventId) redirect("/admin/payouts");
  if (paymentReference.length < 4) {
    redirect(`/admin/payouts/${eventId}?error=${encodeURIComponent("Add the EFT or bank payment reference.")}`);
  }

  const service = createServiceClient();
  if (!service) redirect(`/admin/payouts/${eventId}?error=${encodeURIComponent("Service role is not connected.")}`);

  const before = await getEventPayoutSummary(eventId, service);
  const { data: payout } = await service
    .from("event_payouts")
    .select("id, status, due_date, payable_cents")
    .eq("event_id", eventId)
    .maybeSingle();
  const [{ data: payoutProfile }, { count: activeHolds }] = await Promise.all([
    before.organiserId
      ? service
          .from("organiser_payout_profiles")
          .select("verification_status, verification_reference")
          .eq("user_id", before.organiserId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    service
      .from("payout_holds")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .eq("payout_id", payout?.id ?? "00000000-0000-0000-0000-000000000000"),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  if (!payout || !["eligible", "approved"].includes(payout.status) || !payout.due_date || payout.due_date > today) {
    redirect(`/admin/payouts/${eventId}?error=${encodeURIComponent("This payout is not eligible yet.")}`);
  }
  if ((activeHolds ?? 0) > 0) {
    redirect(`/admin/payouts/${eventId}?error=${encodeURIComponent("Release or apply all payout holds first.")}`);
  }
  if (payoutProfile?.verification_status !== "verified" || !payoutProfile.verification_reference) {
    redirect(`/admin/payouts/${eventId}?error=${encodeURIComponent("Verify the host payout account first.")}`);
  }
  const { data, error } = await service
    .from("event_orders")
    .update({ payout_status: "paid_out" })
    .eq("event_id", eventId)
    .eq("status", "paid")
    .eq("payout_status", "owed")
    .select("id");
  if (error) redirect(`/admin/payouts/${eventId}?error=${encodeURIComponent(error.message)}`);

  await service.from("event_payouts").update({
    status: "paid",
    payment_reference: paymentReference,
    paid_by: session.id,
    paid_at: new Date().toISOString(),
    payout_account_reference: payoutProfile.verification_reference,
    updated_at: new Date().toISOString(),
  }).eq("id", payout.id);

  await service.from("event_audit_events").insert({
    event_id: eventId,
    actor_id: session.id,
    action: "payout_paid_out",
    after: {
      owed_cents: before.owedCents,
      order_ids: (data ?? []).map((row) => row.id),
      marked_at: new Date().toISOString(),
      payment_reference: paymentReference,
    },
  });

  if (before.organiserId) {
    const { data: owner } = await service.auth.admin.getUserById(before.organiserId);
    if (owner.user?.email) {
      await sendVenturoEmail({
        to: owner.user.email,
        subject: `${before.eventTitle || "Event"} payout paid`,
        heading: "Your payout is paid",
        body: `${formatCents(payout.payable_cents)} was marked paid. Payment reference: ${paymentReference}.`,
        href: `${getPublicSiteUrl()}/portal/events/${eventId}/payment`,
        cta: "Open payout report",
      }).catch((caught) => console.error("[payout confirmation]", caught));
    }
  }

  revalidatePath("/admin/payouts");
  revalidatePath(`/admin/payouts/${eventId}`);
  revalidatePath(`/portal/events/${eventId}/payment`);
  redirect(`/admin/payouts/${eventId}?done=paid`);
}

export async function verifyPayoutAccount(formData: FormData) {
  const session = await requireAdmin();
  const eventId = String(formData.get("eventId") ?? "").trim();
  const userId = String(formData.get("userId") ?? "").trim();
  const reference = String(formData.get("verificationReference") ?? "").trim();
  if (!eventId || !userId || reference.length < 4) {
    redirect(`/admin/payouts/${eventId}?error=${encodeURIComponent("Add a verification reference.")}`);
  }
  const service = createServiceClient();
  if (!service) redirect(`/admin/payouts/${eventId}?error=${encodeURIComponent("Service role is not connected.")}`);
  const { error } = await service.from("organiser_payout_profiles").update({
    verification_status: "verified",
    verification_reference: reference,
    verified_at: new Date().toISOString(),
    verified_by: session.id,
  }).eq("user_id", userId);
  if (error) redirect(`/admin/payouts/${eventId}?error=${encodeURIComponent(error.message)}`);
  await service.from("event_audit_events").insert({
    event_id: eventId,
    actor_id: session.id,
    action: "payout_account_verified",
    after: { verification_reference: reference },
  });
  revalidatePath(`/admin/payouts/${eventId}`);
  redirect(`/admin/payouts/${eventId}?done=verified`);
}
