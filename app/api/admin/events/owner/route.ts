import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { assignEventHost } from "@/lib/event-host";
import { isStaff } from "@/lib/roles";

export async function POST(request: Request) {
  const session = await getStaffSession();
  if (!session || !isStaff(session.role)) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }

  const body = (await request.json()) as { eventId?: string; userId?: string };
  if (!body.eventId || !body.userId) {
    return NextResponse.json({ error: "Pick who this event belongs to." }, { status: 400 });
  }

  try {
    await assignEventHost(body.eventId, body.userId, session.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not assign that host.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${body.eventId}`);
  revalidatePath("/portal");
  return NextResponse.json({ ok: true });
}
