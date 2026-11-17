import "server-only";

import { sendVenturoEmail } from "@/lib/email-delivery";
import { notifyMemberUsers } from "@/lib/push-notifications";
import { getPublicSiteUrl } from "@/lib/site-url";
import { createServiceClient } from "@/lib/supabase/admin";

type ReminderEvent = {
  id: string;
  title: string;
  slug: string;
  venue_name: string | null;
  booking_method: "free_rsvp" | "venturo_ticketing" | "external";
  external_provider_name: string | null;
};

type DueOccurrence = {
  id: string;
  event_id: string;
  starts_at: string;
  timezone: string;
  events: ReminderEvent | ReminderEvent[] | null;
};

type JobPayload = {
  kind?: "event" | "community";
  title: string;
  body: string;
  linkPath: string;
  eventId?: string;
  eventSlug?: string;
  communityId?: string;
  announcementId?: string;
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function clock(iso: string, timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-ZA", {
      timeZone: timezone || "Africa/Johannesburg",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat("en-ZA", {
      timeZone: "Africa/Johannesburg",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso));
  }
}

function preferenceEnabled(
  rows: Array<{ user_id: string; channel: string; scope_type: string; scope_id: string | null; enabled: boolean }>,
  userId: string,
  channel: "email" | "push",
  eventId: string,
) {
  const relevant = rows.filter((row) => row.user_id === userId && row.channel === channel);
  const scoped = relevant.find((row) => row.scope_type === "event" && row.scope_id === eventId);
  if (scoped) return scoped.enabled;
  const global = relevant.find((row) => row.scope_type === "global");
  return global?.enabled ?? true;
}

export async function scheduleEventReminderJobs(now = new Date()) {
  const service = createServiceClient();
  if (!service) return { error: "Service role is not connected.", occurrences: 0, queued: 0 };
  const horizon = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  const { data, error } = await service
    .from("event_occurrences")
    .select("id, event_id, starts_at, timezone, events(id, title, slug, venue_name, booking_method, external_provider_name)")
    .eq("status", "scheduled")
    .gt("starts_at", now.toISOString())
    .lte("starts_at", horizon.toISOString())
    .limit(100);
  if (error) return { error: error.message, occurrences: 0, queued: 0 };

  let queued = 0;
  for (const occurrence of (data ?? []) as DueOccurrence[]) {
    const event = one(occurrence.events);
    if (!event) continue;
    const [{ data: tickets }, { data: interests }] = await Promise.all([
      service
        .from("event_tickets")
        .select("buyer_id, event_orders!inner(status)")
        .eq("occurrence_id", occurrence.id)
        .eq("event_orders.status", "paid"),
      service
        .from("event_occurrence_interest")
        .select("user_id")
        .eq("event_id", event.id)
        .eq("occurrence_starts_at", occurrence.starts_at),
    ]);
    const confirmed = new Set<string>();
    for (const row of tickets ?? []) if (row.buyer_id) confirmed.add(row.buyer_id);
    const interested = new Set<string>();
    for (const row of interests ?? []) if (!confirmed.has(row.user_id)) interested.add(row.user_id);
    const users = [...new Set([...confirmed, ...interested])];
    if (!users.length) continue;

    const { data: preferences } = await service
      .from("notification_preferences")
      .select("user_id, channel, scope_type, scope_id, enabled")
      .eq("topic", "event_reminder")
      .in("user_id", users);
    const prefRows = preferences ?? [];

    for (const userId of confirmed) {
      await service
        .from("notification_jobs")
        .update({ status: "cancelled", last_error: "Confirmed participation superseded interest", updated_at: now.toISOString() })
        .eq("occurrence_id", occurrence.id)
        .eq("user_id", userId)
        .like("purpose", "event_interested_%")
        .in("status", ["queued", "failed"]);
    }

    for (const hours of [24, 2] as const) {
      const scheduledFor = new Date(Date.parse(occurrence.starts_at) - hours * 60 * 60 * 1000);
      if (scheduledFor.getTime() < now.getTime() - 5 * 60 * 1000) continue;
      for (const [audience, ids] of [
        ["confirmed", confirmed],
        ["interested", interested],
      ] as const) {
        for (const userId of ids) {
          for (const channel of ["email", "push"] as const) {
            if (!preferenceEnabled(prefRows, userId, channel, event.id)) continue;
            const linkPath = audience === "confirmed" ? "/account/tickets" : `/events/${event.slug}`;
            const action =
              audience === "confirmed"
                ? hours === 24
                  ? "Your ticket is ready."
                  : "Open your ticket before you leave."
                : event.booking_method === "free_rsvp"
                  ? "RSVP free — Interested does not reserve a place."
                  : event.booking_method === "external"
                    ? `Still keen? Book your spot through ${event.external_provider_name?.trim() || "the provider"}.`
                    : "Get tickets — Interested does not reserve a place.";
            const payload: JobPayload = {
              title: event.title.slice(0, 80),
              body: `${hours === 24 ? "Tomorrow" : "In 2 hours"} · ${clock(occurrence.starts_at, occurrence.timezone)}${event.venue_name ? ` at ${event.venue_name}` : ""}. ${action}`.slice(0, 300),
              linkPath,
              eventId: event.id,
              eventSlug: event.slug,
            };
            const purpose = `event_${audience}_${hours}h`;
            const { error: insertError } = await service.from("notification_jobs").upsert(
              {
                purpose,
                event_id: event.id,
                occurrence_id: occurrence.id,
                user_id: userId,
                channel,
                scheduled_for: scheduledFor.toISOString(),
                idempotency_key: `${purpose}:${occurrence.id}:${userId}:${channel}:v1`,
                payload,
              },
              { onConflict: "idempotency_key", ignoreDuplicates: true },
            );
            if (!insertError) queued += 1;
          }
        }
      }
    }
  }
  return { occurrences: data?.length ?? 0, queued };
}

export async function processNotificationJobs(limit = 50) {
  const service = createServiceClient();
  if (!service) return { error: "Service role is not connected.", claimed: 0, sent: 0, failed: 0 };
  await service
    .from("notification_jobs")
    .update({ status: "failed", last_error: "Worker claim expired" })
    .eq("status", "processing")
    .lt("claimed_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
  const { data, error } = await service.rpc("claim_due_notification_jobs", { p_limit: limit });
  if (error) return { error: error.message, claimed: 0, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  for (const job of data ?? []) {
    const payload = job.payload as JobPayload;
    try {
      let provider = "native";
      let providerMessageId = `push:${job.id}`;
      if (job.channel === "email") {
        const { data: recipient, error: userError } = await service.auth.admin.getUserById(job.user_id);
        if (userError || !recipient.user?.email) throw new Error(userError?.message || "Recipient has no email.");
        const result = await sendVenturoEmail({
          to: recipient.user.email,
          subject: payload.title,
          heading: payload.title,
          body: payload.body,
          href: `${getPublicSiteUrl()}${payload.linkPath}`,
          cta:
            payload.linkPath === "/account/tickets"
              ? "Open tickets"
              : payload.kind === "community"
                ? "Open in Venturo"
                : "Open event",
        });
        provider = result.provider;
        providerMessageId = result.id;
      } else {
        const result = await notifyMemberUsers({
          userIds: [job.user_id],
          title: payload.title,
          body: payload.body,
          linkPath: payload.linkPath,
          kind: payload.kind === "community" ? "community" : "event",
          id: payload.communityId ?? payload.eventId ?? "",
          slug: payload.eventSlug ?? "",
          notice: payload.kind === "community" ? "community" : "remind",
        });
        if (result.error) throw new Error(result.error);
      }
      await service.from("notification_deliveries").insert({
        job_id: job.id,
        provider,
        provider_message_id: providerMessageId,
        status: "accepted",
      });
      await service.from("notification_jobs").update({
        status: "sent",
        updated_at: new Date().toISOString(),
        last_error: null,
      }).eq("id", job.id);
      if (job.announcement_id) {
        const { count } = await service
          .from("notification_jobs")
          .select("id", { count: "exact", head: true })
          .eq("announcement_id", job.announcement_id)
          .in("status", ["queued", "processing", "failed"]);
        if (!count) {
          await service
            .from("community_announcements")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", job.announcement_id);
        }
      }
      sent += 1;
    } catch (caught) {
      const attempts = Number(job.attempts) || 1;
      const retryAt = new Date(Date.now() + Math.min(60, 2 ** attempts) * 60 * 1000).toISOString();
      await service.from("notification_jobs").update({
        status: "failed",
        next_attempt_at: attempts >= 5 ? null : retryAt,
        last_error: caught instanceof Error ? caught.message.slice(0, 500) : "Delivery failed",
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      failed += 1;
    }
  }
  return { claimed: data?.length ?? 0, sent, failed };
}
