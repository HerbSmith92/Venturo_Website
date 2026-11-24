import { NextResponse } from "next/server";
import { bearerToken } from "@/lib/supabase/bearer";
import { isAttendeeAudience, sendEventAttendeePush } from "@/lib/event-attendee-push";

export async function POST(request: Request, context: { params: Promise<{ eventId: string }> }) {
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Log in to send an update." }, { status: 401 });
  }

  const { eventId } = await context.params;
  const body = (await request.json().catch(() => null)) as { audience?: string; title?: string; body?: string } | null;
  const audience = body?.audience ?? "";
  if (!isAttendeeAudience(audience)) {
    return NextResponse.json({ error: "Choose who should receive this." }, { status: 400 });
  }

  const sent = await sendEventAttendeePush({
    accessToken: token,
    eventId,
    audience,
    title: body?.title ?? "",
    body: body?.body ?? "",
  });
  if (sent.error) return NextResponse.json({ error: sent.error }, { status: sent.status });
  return NextResponse.json(sent.result);
}
