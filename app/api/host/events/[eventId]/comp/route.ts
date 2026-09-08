import { NextResponse } from "next/server";
import { loadPortalEvent } from "@/lib/event-access";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const loaded = await loadPortalEvent(eventId, "editor");
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }
  const { event } = loaded;
  const body = (await request.json()) as {
    name?: string;
    email?: string;
    phone?: string;
    ticketTypeId?: string;
  };

  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const ticketTypeId = body.ticketTypeId ?? event.ticketTypes[0]?.id;
  if (!name || !email) {
    return NextResponse.json({ error: "Name & email are required." }, { status: 400 });
  }
  if (!ticketTypeId) {
    return NextResponse.json({ error: "Add a ticket type first." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not connected." }, { status: 503 });
  }

  const { error } = await supabase.rpc("host_issue_comp", {
    p_event_id: event.id,
    p_ticket_type_id: ticketTypeId,
    p_name: name,
    p_email: email,
    p_phone: (body.phone ?? "").trim() || null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
