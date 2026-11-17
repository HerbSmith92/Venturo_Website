import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { slugKey } from "@/lib/catalog-admin";
import { achievementSummary } from "@/lib/wallet-types";
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
    name?: string;
    description?: string | null;
    imagePath?: string | null;
    tier?: string | null;
    criteriaKind?: "attend_events" | "attend_occurrences";
    criteria?: Record<string, unknown>;
    tokenReward?: number;
    sortOrder?: number;
    isActive?: boolean;
    status?: "draft" | "published" | "archived";
    progressPolicy?: "preserve_earned" | "reset_progress";
  };

  if (body.action === "archive") {
    if (!body.id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const { error } = await service
      .from("achievements")
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

  const name = asText(body.name, 80);
  if (!name) return NextResponse.json({ error: "A name is required." }, { status: 400 });

  const criteriaKind = body.criteriaKind === "attend_occurrences" ? "attend_occurrences" : "attend_events";
  const criteria = {
    count: Math.max(1, Number(body.criteria?.count) || 1),
    ...(body.criteria?.windowDays ? { windowDays: Number(body.criteria.windowDays) } : {}),
  };
  const summary = achievementSummary({ criteria_kind: criteriaKind, criteria });
  const progressPolicy = body.progressPolicy === "reset_progress" ? "reset_progress" : "preserve_earned";

  const payload = {
    name,
    description: asText(body.description, 280) || null,
    image_path: body.imagePath ?? null,
    tier: body.tier || null,
    criteria_kind: criteriaKind,
    criteria,
    criteria_summary: summary,
    token_reward: Math.max(0, Number(body.tokenReward) || 0),
    sort_order: Number.isInteger(body.sortOrder) ? Math.max(1, Number(body.sortOrder)) : 1,
    is_active: body.isActive !== false,
    status: body.status === "published" ? "published" : body.status === "archived" ? "archived" : "draft",
    updated_at: new Date().toISOString(),
    updated_by: session.id,
    ...(body.status === "published"
      ? { published_at: new Date().toISOString(), published_by: session.id }
      : {}),
  };

  let achievementId = body.id;
  if (achievementId) {
    const { error } = await service.from("achievements").update(payload).eq("id", achievementId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (progressPolicy === "reset_progress") {
      await service.from("member_achievements").delete().eq("achievement_id", achievementId);
    }
  } else {
    const { data, error } = await service
      .from("achievements")
      .insert({
        ...payload,
        key: `${slugKey(name)}_${Date.now().toString(36)}`.slice(0, 48),
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    achievementId = data.id;
  }

  await service.from("achievement_revisions").insert({
    achievement_id: achievementId,
    action: body.status === "published" ? "publish" : body.id ? "save" : "create",
    snapshot: payload,
    progress_policy: progressPolicy,
    actor_id: session.id,
  });

  return NextResponse.json({ ok: true, id: achievementId, criteriaSummary: summary });
}
