import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { getEventById } from "@/lib/events";
import { PORTAL_LOGIN } from "@/lib/portal";
import { isStaff } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import type { VenturoEvent } from "@/lib/event-types";
import { notFound, redirect } from "next/navigation";

export type EventAccessLevel = "owner" | "staff" | "editor" | "door";

export type PortalEventContext = {
  user: CurrentUser;
  event: VenturoEvent;
  access: EventAccessLevel;
  canEdit: boolean;
  canDoor: boolean;
};

export async function getCollaboratorAccess(
  eventId: string,
  userId: string,
): Promise<"editor" | "door" | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("event_collaborators")
      .select("access")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    if (data.access === "editor" || data.access === "door") return data.access;
    return null;
  } catch {
    return null;
  }
}

export async function resolveEventAccess(
  event: VenturoEvent,
  user: CurrentUser,
): Promise<EventAccessLevel | null> {
  if (isStaff(user.role)) return "staff";
  if (event.organiserId === user.id) return "owner";
  return getCollaboratorAccess(event.id, user.id);
}

export async function loadPortalEvent(
  eventId: string,
  min: "door" | "editor" = "door",
): Promise<PortalEventContext | { error: string; status: number }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Log in first.", status: 401 };

  const event = await getEventById(eventId);
  if (!event) return { error: "Event not found.", status: 404 };

  const access = await resolveEventAccess(event, user);
  if (!access) return { error: "Event not found.", status: 404 };

  const canEdit = access === "owner" || access === "staff" || access === "editor";
  const canDoor = canEdit || access === "door";
  if (min === "editor" && !canEdit) return { error: "Not allowed.", status: 403 };
  if (min === "door" && !canDoor) return { error: "Not allowed.", status: 403 };

  return { user, event, access, canEdit, canDoor };
}

export async function requirePortalEvent(
  eventId: string,
  min: "door" | "editor" = "door",
): Promise<PortalEventContext> {
  const loaded = await loadPortalEvent(eventId, min);
  if ("error" in loaded) {
    if (loaded.status === 401) redirect(PORTAL_LOGIN);
    notFound();
  }
  return loaded;
}
