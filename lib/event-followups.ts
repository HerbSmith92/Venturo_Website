import { sendGuestReviewEmail, sendHostFollowUpEmail } from "@/lib/event-followup-email";
import { notifyMemberUsers } from "@/lib/push-notifications";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const FOLLOWUP_WINDOW_MS = 72 * 60 * 60 * 1000;

export type EventHostReport = {
  happened: boolean;
  note: string;
  updatedAt: string;
};

export type EventReview = {
  id: string;
  eventId: string;
  rating: number;
  body: string;
  authorName: string;
  createdAt: string;
};

export async function loadHostReport(eventId: string): Promise<EventHostReport | null> {
  const supabase = (await createClient()) ?? createServiceClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("event_host_reports")
    .select("happened, note, updated_at")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error || !data) return null;
  return { happened: Boolean(data.happened), note: data.note, updatedAt: data.updated_at };
}

export async function loadMyEventReview(eventId: string, userId: string): Promise<EventReview | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("event_reviews")
    .select("id, event_id, rating, body, author_name, created_at")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    eventId: data.event_id,
    rating: data.rating,
    body: data.body,
    authorName: data.author_name,
    createdAt: data.created_at,
  };
}

export async function buyerHasTicket(eventId: string, userId: string) {
  const supabase = await createClient();
  if (!supabase) return false;
  const { data } = await supabase
    .from("event_tickets")
    .select("id")
    .eq("event_id", eventId)
    .eq("buyer_id", userId)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

export async function sendDueEventFollowups(eventId?: string) {
  const service = createServiceClient();
  if (!service) return { error: "Service role is not connected." };

  const now = new Date();
  const since = new Date(now.getTime() - FOLLOWUP_WINDOW_MS).toISOString();
  let query = service
    .from("events")
    .select("id, title, slug, organiser_id, ends_at, status")
    .eq("status", "approved")
    .not("ends_at", "is", null)
    .lte("ends_at", now.toISOString());
  if (eventId) query = query.eq("id", eventId);
  else query = query.gte("ends_at", since);

  const { data: events, error } = await query.limit(50);
  if (error) return { error: error.message };
  const due = events ?? [];
  let hosts = 0;
  let guests = 0;

  for (const event of due) {
    const { data: existing } = await service
      .from("event_followup_sends")
      .select("event_id, host_sent_at, guest_sent_at")
      .eq("event_id", event.id)
      .maybeSingle();
    if (!existing) {
      await service.from("event_followup_sends").insert({ event_id: event.id });
    }

    if (!existing?.host_sent_at) {
      const claimed = await service
        .from("event_followup_sends")
        .update({ host_sent_at: now.toISOString() })
        .eq("event_id", event.id)
        .is("host_sent_at", null)
        .select("event_id");
      if (claimed.data?.length) {
        await notifyHost(service, event);
        hosts += 1;
      }
    }

    if (!existing?.guest_sent_at) {
      const claimed = await service
        .from("event_followup_sends")
        .update({ guest_sent_at: now.toISOString() })
        .eq("event_id", event.id)
        .is("guest_sent_at", null)
        .select("event_id");
      if (claimed.data?.length) {
        guests += await notifyGuests(service, event);
      }
    }
  }

  return { events: due.length, hosts, guests };
}

async function notifyHost(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  event: { id: string; title: string; slug: string | null; organiser_id: string },
) {
  const { data } = await service.auth.admin.getUserById(event.organiser_id);
  const email = data.user?.email?.trim();
  if (email) await sendHostFollowUpEmail(email, event.title, event.id);
  await notifyMemberUsers({
    userIds: [event.organiser_id],
    title: "How did it go?",
    body: `Tell us if ${event.title} happened & how the night went.`,
    linkPath: `/portal/events/${event.id}/follow-up`,
    kind: "event",
    id: event.id,
    slug: event.slug || event.id,
    notice: "custom",
  });
}

async function notifyGuests(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  event: { id: string; title: string; slug: string | null; organiser_id: string },
) {
  const { data: tickets } = await service
    .from("event_tickets")
    .select("buyer_id")
    .eq("event_id", event.id);
  const buyerIds = [
    ...new Set((tickets ?? []).map((row) => row.buyer_id as string).filter((id) => id && id !== event.organiser_id)),
  ];
  if (!buyerIds.length) return 0;

  await notifyMemberUsers({
    userIds: buyerIds,
    title: "How was it?",
    body: `Leave a short review of ${event.title}.`,
    linkPath: `/account/reviews/event/${event.id}`,
    kind: "event",
    id: event.id,
    slug: event.slug || event.id,
    notice: "custom",
  });

  let sent = 0;
  for (const buyerId of buyerIds) {
    const { data } = await service.auth.admin.getUserById(buyerId);
    const email = data.user?.email?.trim();
    if (!email) continue;
    const ok = await sendGuestReviewEmail(email, event.title, event.id);
    if (ok) sent += 1;
  }
  return sent;
}
