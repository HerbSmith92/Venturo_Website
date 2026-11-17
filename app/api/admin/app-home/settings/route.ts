import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { isAppHomeScreen, parseAppHomeSettings } from "@/lib/app-home-types";
import { isAdmin } from "@/lib/roles";
import { createServiceClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const session = await getStaffSession();
  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Supabase is not connected." }, { status: 503 });

  const body = (await request.json()) as {
    screen?: string;
    settings?: Record<string, unknown>;
  };

  if (!body.screen || !isAppHomeScreen(body.screen)) {
    return NextResponse.json({ error: "Unknown screen." }, { status: 400 });
  }

  const settings = parseAppHomeSettings(body.settings ?? {});
  const { error } = await service.from("app_home_screens").upsert({
    screen: body.screen,
    settings,
    updated_at: new Date().toISOString(),
    updated_by: session.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await service.from("app_home_revisions").insert({
    screen: body.screen,
    entity_kind: "settings",
    entity_id: null,
    action: "save",
    snapshot: settings,
    actor_id: session.id,
  });

  return NextResponse.json({ ok: true, settings });
}
