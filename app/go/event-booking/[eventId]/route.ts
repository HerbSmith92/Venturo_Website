import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import { VISITOR_COOKIE, visitorKeyFromCookie } from "@/lib/search-misses";
import { cookies } from "next/headers";

function safeExternalUrl(value: string | null | undefined) {
  try {
    const url = new URL(value ?? "");
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase())) return null;
    return url;
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const service = createServiceClient();
  if (!service) return NextResponse.redirect(new URL("/events", request.url));

  const { data: event } = await service
    .from("events")
    .select("id, status, visibility, booking_method, external_booking_url")
    .eq("id", eventId)
    .maybeSingle();
  const destination =
    event?.status === "approved" &&
    event?.visibility === "public" &&
    event?.booking_method === "external"
      ? safeExternalUrl(event.external_booking_url)
      : null;
  if (!destination) return NextResponse.redirect(new URL("/events", request.url));

  const incoming = new URL(request.url);
  const occurrenceId = incoming.searchParams.get("occurrence");
  const store = await cookies();
  const visitorKey = visitorKeyFromCookie(store.get(VISITOR_COOKIE)?.value);
  const user = await getCurrentUser();
  await service.from("event_outbound_booking_clicks").insert({
    event_id: eventId,
    occurrence_id: occurrenceId || null,
    user_id: user?.id ?? null,
    visitor_key: visitorKey,
    source: incoming.searchParams.get("source"),
    campaign: incoming.searchParams.get("utm_campaign"),
  });

  return NextResponse.redirect(destination, 302);
}
