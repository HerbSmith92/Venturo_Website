import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const session = await getStaffSession();
  if (!session || !isStaff(session.role)) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }

  // Control Room UI is still admin-gated by layout; allow editor via RPC if JWT has role.
  if (session.role !== "admin" && session.role !== "editor") {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }

  const body = (await request.json()) as {
    eventId?: string;
    action?: string;
    note?: string;
  };

  if (!body.eventId || !body.action) {
    return NextResponse.json({ error: "Missing action." }, { status: 400 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not connected." }, { status: 503 });
  }

  const { error } = await supabase.rpc("admin_apply_event_action", {
    p_event_id: body.eventId,
    p_action: body.action,
    p_note: body.note ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
