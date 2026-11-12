import "server-only";

import { notifyMemberUsers } from "@/lib/push-notifications";
import { createServiceClient } from "@/lib/supabase/admin";
import { createBearerClient, identityFromBearer } from "@/lib/supabase/bearer";

export type AttendeeAudience = "all" | "checked_in" | "waiting";

export type AttendeePushResult = {
  intended: number;
  accepted: number;
  failed: number;
  missingToken: number;
};

const AUDIENCE_ALIASES: Record<string, AttendeeAudience> = {
  all: "all",
  attendees: "all",
  all_attendees: "all",
  checked_in: "checked_in",
  "checked-in": "checked_in",
  arrived: "checked_in",
  waiting: "waiting",
  still_to_arrive: "waiting",
  to_arrive: "waiting",
  remaining: "waiting",
};

export function parseAttendeeAudience(value: string | undefined): AttendeeAudience | null {
  const key = (value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  return AUDIENCE_ALIASES[key] ?? null;
}

export function isAttendeeAudience(value: string): value is AttendeeAudience {
  return parseAttendeeAudience(value) !== null;
}

function rpcStatus(message: string) {
  if (message.includes("not authenticated")) return { error: "Log in to send an update.", status: 401 };
  if (message.includes("not allowed")) {
    return { error: "You cannot message guests for this event.", status: 403 };
  }
  if (message.includes("duplicate update")) {
    return { error: "That update was just sent. Wait a moment before sending it again.", status: 429 };
  }
  if (message.includes("too many updates")) {
    return { error: "This event has had six updates in the last hour. Try again later.", status: 429 };
  }
  if (message.includes("message length")) {
    return { error: "Write a short update, up to 180 characters.", status: 400 };
  }
  if (message.includes("unknown audience")) {
    return { error: "Choose who should receive this.", status: 400 };
  }
  return { error: message, status: 400 };
}

export async function sendEventAttendeePush(input: {
  accessToken: string;
  eventId: string;
  audience: string;
  title: string;
  body: string;
}): Promise<{ result?: AttendeePushResult; error?: string; status: number }> {
  const audience = parseAttendeeAudience(input.audience);
  if (!audience) return { error: "Choose who should receive this.", status: 400 };

  const title = input.title.trim().slice(0, 80);
  const body = input.body.trim().slice(0, 180);
  if (!title) return { error: "The event name is missing.", status: 400 };
  if (!body) return { error: "Write the update before sending it.", status: 400 };

  const identity = await identityFromBearer(input.accessToken);
  const userClient = createBearerClient(input.accessToken);
  if (!identity || !userClient) return { error: "Log in to send an update.", status: 401 };

  const allowed = await userClient.rpc("event_hub_can", {
    p_event_id: input.eventId,
    p_capability: "send_messages",
  });
  if (allowed.error || allowed.data !== true) {
    return { error: "You cannot message guests for this event.", status: 403 };
  }

  const service = createServiceClient();
  if (!service) return { error: "Push is not configured on the server.", status: 500 };

  const claimed = await userClient.rpc("record_attendee_update", {
    p_event_id: input.eventId,
    p_audience: audience,
    p_body: body,
    p_intended: 0,
    p_accepted: 0,
    p_failed: 0,
    p_unreachable: 0,
  });
  if (claimed.error || !claimed.data) {
    return rpcStatus(claimed.error?.message ?? "Could not record the update.");
  }
  const updateId = claimed.data as string;

  const ids = await userClient.rpc("event_update_audience", {
    p_event_id: input.eventId,
    p_audience: audience,
  });
  if (ids.error) {
    return rpcStatus(ids.error.message);
  }
  const userIds = [
    ...new Set(((ids.data as { user_id: string }[] | null) ?? []).map((row) => row.user_id).filter(Boolean)),
  ];

  const event = await service.from("events").select("id, slug, title").eq("id", input.eventId).maybeSingle();
  const slug = (event.data?.slug as string | undefined)?.trim() || input.eventId;
  const linkPath = `/events/${slug}`;

  const delivered = await notifyMemberUsers({
    userIds,
    title,
    body,
    linkPath,
    kind: "event",
    id: input.eventId,
    slug,
    notice: "custom",
    createdBy: identity.id,
  });

  const result: AttendeePushResult = {
    intended: userIds.length,
    accepted: delivered.pushed,
    failed: delivered.failed,
    missingToken: delivered.missingToken,
  };

  await service
    .from("event_attendee_updates")
    .update({
      intended_count: result.intended,
      accepted_count: result.accepted,
      failed_count: result.failed,
      unreachable_count: result.missingToken,
    })
    .eq("id", updateId);

  return { result, status: 200 };
}
