import { NextResponse } from "next/server";
import { loadPortalEvent } from "@/lib/event-access";
import { createServiceClient } from "@/lib/supabase/admin";
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
  const { event, access } = loaded;
  if (access !== "owner" && access !== "staff") {
    return NextResponse.json({ error: "Only the owner can add people." }, { status: 403 });
  }

  const body = (await request.json()) as { email?: string; access?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  const collabAccess = body.access === "door" ? "door" : "editor";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Add an email." }, { status: 400 });
  }

  const supabase = await createClient();
  const admin = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not connected." }, { status: 503 });
  }

  let userId: string | null = null;
  if (admin) {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    userId = match?.id ?? null;
  }

  const { error } = await supabase.from("event_collaborators").upsert(
    {
      event_id: event.id,
      email,
      access: collabAccess,
      user_id: userId,
    },
    { onConflict: "event_id,email" },
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const loaded = await loadPortalEvent(eventId, "editor");
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }
  const { access } = loaded;
  if (access !== "owner" && access !== "staff") {
    return NextResponse.json({ error: "Only the owner can remove people." }, { status: 403 });
  }
  const body = (await request.json()) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "Missing person." }, { status: 400 });

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not connected." }, { status: 503 });
  }
  const { error } = await supabase.from("event_collaborators").delete().eq("id", body.id).eq("event_id", eventId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
