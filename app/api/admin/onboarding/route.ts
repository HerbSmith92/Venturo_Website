import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { slugKey } from "@/lib/catalog-admin";
import { isAdmin } from "@/lib/roles";
import { createServiceClient } from "@/lib/supabase/admin";

function asText(value: unknown, max = 120) {
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
  if (!service) {
    return NextResponse.json({ error: "Supabase is not connected." }, { status: 503 });
  }

  const body = (await request.json()) as {
    entity?: string;
    action?: string;
    id?: string;
    title?: string;
    subtitle?: string;
    description?: string;
    isActive?: boolean;
    sortOrder?: number;
    interestId?: string;
    kindId?: string;
    typicalScaleRank?: number;
  };

  if (body.entity !== "scale" && body.entity !== "bucket") {
    return NextResponse.json({ error: "Unknown catalogue item." }, { status: 400 });
  }

  if (body.action === "remove") {
    if (!body.id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const table = body.entity === "scale" ? "activity_scales" : "bucket_items";
    const { error } = await service.from(table).update({ is_active: false }).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.action !== "save") {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const title = asText(body.title, 80);
  if (!title) return NextResponse.json({ error: "A title is required." }, { status: 400 });

  if (body.entity === "scale") {
    if (!body.id) {
      return NextResponse.json(
        { error: "Adventure levels keep fixed ranks. Edit an existing level instead of adding a sixth." },
        { status: 400 },
      );
    }
    const payload = {
      title,
      subtitle: asText(body.subtitle, 160) || title,
      is_active: body.isActive !== false,
      updated_at: new Date().toISOString(),
    };
    const { error } = await service.from("activity_scales").update(payload).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const interestId = asText(body.interestId, 64);
  const kindId = asText(body.kindId, 64);
  const rank = Number(body.typicalScaleRank);
  if (!interestId || !kindId) {
    return NextResponse.json({ error: "Pick an interest & category." }, { status: 400 });
  }
  if (!Number.isInteger(rank) || rank < 1 || rank > 5) {
    return NextResponse.json({ error: "Adventure level must be 1–5." }, { status: 400 });
  }

  const payload = {
    title,
    description: asText(body.description, 280) || null,
    interest_id: interestId,
    activity_kind_id: kindId,
    typical_scale_rank: rank,
    is_active: body.isActive !== false,
    ...(Number.isInteger(body.sortOrder) ? { sort_order: Math.max(1, Number(body.sortOrder)) } : {}),
    updated_at: new Date().toISOString(),
  };

  if (body.id) {
    const { error } = await service.from("bucket_items").update(payload).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else {
    const { count } = await service.from("bucket_items").select("id", { count: "exact", head: true });
    const { error } = await service.from("bucket_items").insert({
      ...payload,
      key: `${slugKey(title)}_${Date.now().toString(36)}`.slice(0, 40),
      sort_order: (count ?? 0) + 1,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
