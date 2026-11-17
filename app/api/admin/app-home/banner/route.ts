import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { isAppHomeScreen } from "@/lib/app-home";
import { isAdmin } from "@/lib/roles";
import { createServiceClient } from "@/lib/supabase/admin";

function asText(value: unknown, max = 160) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

export async function POST(request: Request) {
  const session = await getStaffSession();
  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Supabase is not connected." }, { status: 503 });

  const body = (await request.json()) as {
    action?: string;
    id?: string;
    screen?: string;
    adminName?: string;
    title?: string | null;
    supportingText?: string | null;
    buttonLabel?: string | null;
    imagePath?: string | null;
    focalX?: number;
    focalY?: number;
    destinationKind?: string | null;
    destinationId?: string | null;
    destinationUrl?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
    status?: "draft" | "published" | "archived";
  };

  if (!body.screen || !isAppHomeScreen(body.screen)) {
    return NextResponse.json({ error: "Unknown screen." }, { status: 400 });
  }

  if (body.action === "archive") {
    if (!body.id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const { error } = await service
      .from("app_home_banners")
      .update({
        status: "archived",
        is_active: false,
        updated_at: new Date().toISOString(),
        updated_by: session.id,
      })
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const payload = {
    screen: body.screen,
    admin_name: asText(body.adminName, 80) || asText(body.title, 80) || "Banner",
    title: asText(body.title, 80) || null,
    supporting_text: asText(body.supportingText, 160) || null,
    button_label: asText(body.buttonLabel, 40) || null,
    image_path: body.imagePath ?? null,
    focal_x: Math.min(1, Math.max(0, Number(body.focalX ?? 0.5))),
    focal_y: Math.min(1, Math.max(0, Number(body.focalY ?? 0.5))),
    destination_kind: body.destinationKind || null,
    destination_id: body.destinationId || null,
    destination_url: asText(body.destinationUrl, 500) || null,
    sort_order: Number.isInteger(body.sortOrder) ? Math.max(1, Number(body.sortOrder)) : 1,
    is_active: body.isActive !== false,
    starts_at: body.startsAt || null,
    ends_at: body.endsAt || null,
    status: body.status === "published" ? "published" : body.status === "archived" ? "archived" : "draft",
    updated_at: new Date().toISOString(),
    updated_by: session.id,
    ...(body.status === "published"
      ? { published_at: new Date().toISOString(), published_by: session.id }
      : {}),
  };

  if (body.id) {
    const { error } = await service.from("app_home_banners").update(payload).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await service.from("app_home_revisions").insert({
      screen: body.screen,
      entity_kind: "banner",
      entity_id: body.id,
      action: body.status === "published" ? "publish" : "save",
      snapshot: payload,
      actor_id: session.id,
    });
    return NextResponse.json({ ok: true, id: body.id });
  }

  const { data, error } = await service
    .from("app_home_banners")
    .insert(payload)
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await service.from("app_home_revisions").insert({
    screen: body.screen,
    entity_kind: "banner",
    entity_id: data.id,
    action: "create",
    snapshot: payload,
    actor_id: session.id,
  });
  return NextResponse.json({ ok: true, id: data.id });
}
