"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getEventBySlug } from "@/lib/events";
import { createTicketOrder } from "@/lib/orders";
import { hasMemberConsent } from "@/lib/policy-consent";
import { getPublicSiteUrl } from "@/lib/site-url";
import { recordWebsiteConversion } from "@/lib/analytics-conversions";

export async function rsvpFreeEvent(formData: FormData) {
  const eventSlug = String(formData.get("event_slug") ?? "").trim();
  const occurrenceStartsAt = String(formData.get("occurrence_starts_at") ?? "").trim();
  const next = `/events/${encodeURIComponent(eventSlug)}${occurrenceStartsAt ? `?on=${encodeURIComponent(occurrenceStartsAt)}` : ""}`;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`${next}#tickets`)}`);
  if (!(await hasMemberConsent(user.id))) {
    redirect(`${next}${next.includes("?") ? "&" : "?"}bookingError=${encodeURIComponent("Review the required terms in checkout before your first RSVP.")}#tickets`);
  }

  const event = await getEventBySlug(eventSlug);
  if (!event || event.status !== "approved" || event.bookingMethod !== "free_rsvp") {
    redirect(`${next}${next.includes("?") ? "&" : "?"}bookingError=${encodeURIComponent("RSVP is not available for this event.")}#tickets`);
  }
  const ticket = event.ticketTypes.find(
    (item) => item.listed && !item.membersOnly && (item.kind === "free" || item.priceCents === 0),
  );
  if (!ticket) {
    redirect(`${next}${next.includes("?") ? "&" : "?"}bookingError=${encodeURIComponent("This RSVP has not been configured yet.")}#tickets`);
  }

  let orderId: string;
  try {
    const order = await createTicketOrder({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      eventSlug,
      lines: [{ ticketTypeId: ticket.id, quantity: 1 }],
      paidMember: user.plan === "paid",
      origin: getPublicSiteUrl(),
      occurrenceStartsAt,
      bookingSource: "free_rsvp",
      activityPlatform: "web",
    });
    orderId = order.orderId;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not complete the RSVP.";
    redirect(`${next}${next.includes("?") ? "&" : "?"}bookingError=${encodeURIComponent(message)}#tickets`);
  }
  await recordWebsiteConversion({
    name: "rsvp",
    path: `/events/${eventSlug}`,
    userId: user.id,
    orderId,
  });
  redirect(
    `${next}${next.includes("?") ? "&" : "?"}rsvp=1&order=${encodeURIComponent(orderId)}#tickets`,
  );
}

export async function joinEventWaitlist(formData: FormData) {
  const eventId = String(formData.get("event_id") ?? "");
  const occurrenceId = String(formData.get("occurrence_id") ?? "");
  const ticketTypeId = String(formData.get("ticket_type_id") ?? "") || null;
  const next = String(formData.get("next") ?? "/events");
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  if (!supabase) redirect(`${next}${next.includes("?") ? "&" : "?"}bookingError=Waitlist+is+unavailable.`);
  const { error } = await supabase.from("event_waitlist_entries").insert({
    occurrence_id: occurrenceId,
    ticket_type_id: ticketTypeId,
    user_id: user.id,
    party_size: 1,
  });
  if (error && error.code !== "23505") {
    redirect(`${next}${next.includes("?") ? "&" : "?"}bookingError=${encodeURIComponent(error.message)}`);
  }
  redirect(`${next}${next.includes("?") ? "&" : "?"}waitlist=1#tickets`);
}
