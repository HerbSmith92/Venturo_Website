import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { johannesburgDay } from "@/lib/portal-home";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID.test(id)) {
    return new NextResponse(null, { status: 204 });
  }

  const supabase = await createClient();
  if (!supabase) return new NextResponse(null, { status: 204 });

  const { data: event } = await supabase
    .from("events")
    .select("id, organiser_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!event || event.status !== "approved") {
    return new NextResponse(null, { status: 204 });
  }

  const user = await getCurrentUser();
  if (user && (user.id === event.organiser_id || user.role === "admin" || user.role === "editor")) {
    return new NextResponse(null, { status: 204 });
  }

  const admin = createServiceClient();
  if (!admin) return new NextResponse(null, { status: 204 });

  const day = johannesburgDay();
  const { data: existing } = await admin
    .from("event_view_days")
    .select("views")
    .eq("event_id", id)
    .eq("day", day)
    .maybeSingle();

  const views = (existing?.views ?? 0) + 1;
  await admin.from("event_view_days").upsert(
    { event_id: id, day, views },
    { onConflict: "event_id,day" },
  );

  return new NextResponse(null, { status: 204 });
}
