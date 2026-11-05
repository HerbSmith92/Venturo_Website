"use server";

import { getCurrentUser, requireStaff } from "@/lib/auth";
import { requirePortalEvent } from "@/lib/event-access";
import { getEventById } from "@/lib/events";
import { buyerHasTicket, sendDueEventFollowups } from "@/lib/event-followups";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function sendEventFollowUpNow(formData: FormData) {
  await requireStaff();
  const eventId = String(formData.get("eventId") ?? "").trim();
  const result = await sendDueEventFollowups(eventId || undefined);
  const next = eventId ? `/admin/payouts/${eventId}` : "/admin/payouts";
  if ("error" in result && result.error) {
    redirect(`${next}?error=${encodeURIComponent(result.error)}`);
  }
  revalidatePath("/admin/payouts");
  redirect(`${next}?done=followup`);
}

export async function saveHostFollowUp(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const { event } = await requirePortalEvent(eventId, "editor");
  if (!event.endsAt || new Date(event.endsAt).getTime() > Date.now()) {
    redirect(`/portal/events/${eventId}/follow-up?error=${encodeURIComponent("This opens once the event has ended.")}`);
  }
  const happenedRaw = String(formData.get("happened") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (happenedRaw !== "yes" && happenedRaw !== "no") {
    redirect(`/portal/events/${eventId}/follow-up?error=${encodeURIComponent("Tell us if the event happened.")}`);
  }
  if (!note || note.length > 2000) {
    redirect(`/portal/events/${eventId}/follow-up?error=${encodeURIComponent("Add a short note on how it went.")}`);
  }
  const user = await getCurrentUser();
  const supabase = await createClient();
  if (!user || !supabase) redirect(`/portal/events/${eventId}/follow-up`);
  const { error } = await supabase.from("event_host_reports").upsert(
    {
      event_id: eventId,
      user_id: user.id,
      happened: happenedRaw === "yes",
      note,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id" },
  );
  if (error) redirect(`/portal/events/${eventId}/follow-up?error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/portal/events/${eventId}/follow-up`);
  revalidatePath(`/portal/events/${eventId}/dashboard`);
  redirect(`/portal/events/${eventId}/follow-up?saved=1`);
}

export async function saveEventReview(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const next = `/account/reviews/event/${eventId}`;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const allowed = await buyerHasTicket(eventId, user.id);
  if (!allowed) redirect(`${next}?error=${encodeURIComponent("This review is for people who had a ticket.")}`);
  const event = await getEventById(eventId);
  if (!event?.endsAt || new Date(event.endsAt).getTime() > Date.now()) {
    redirect(`${next}?error=${encodeURIComponent("Reviews open once the event has ended.")}`);
  }
  const rating = Number(formData.get("rating"));
  const body = String(formData.get("body") ?? "").trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !body || body.length > 2000) {
    redirect(`${next}?error=${encodeURIComponent("Add a rating and a short note.")}`);
  }
  const supabase = await createClient();
  if (!supabase) redirect(next);
  const { error } = await supabase.from("event_reviews").upsert(
    {
      event_id: eventId,
      user_id: user.id,
      author_name: user.firstName || "Member",
      rating,
      body,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id,user_id" },
  );
  if (error) redirect(`${next}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(next);
  revalidatePath("/account/reviews");
  redirect(`${next}?saved=1`);
}
