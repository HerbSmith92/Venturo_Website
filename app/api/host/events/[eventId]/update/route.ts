import { NextResponse } from "next/server";
import { parseAttendeeAudience, sendEventAttendeePush } from "@/lib/event-attendee-push";
import { bearerToken } from "@/lib/supabase/bearer";

export async function POST(request: Request, context: { params: Promise<{ eventId: string }> }) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: "Log in to send an update." }, { status: 401 });

  const { eventId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    audience?: string;
    title?: string;
    body?: string;
  } | null;

  if (!parseAttendeeAudience(body?.audience)) {
    return NextResponse.json({ error: "Choose who should receive this." }, { status: 400 });
  }

  const sent = await sendEventAttendeePush({
    accessToken: token,
    eventId,
    audience: body?.audience ?? "",
    title: body?.title ?? "",
    body: body?.body ?? "",
  });
  if (sent.error && !sent.result) {
    return NextResponse.json({ error: sent.error }, { status: sent.status });
  }
  return NextResponse.json(sent.result, { status: sent.status });
}
