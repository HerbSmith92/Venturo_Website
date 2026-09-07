import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { slugKey } from "@/lib/catalog-admin";
import { isAdmin } from "@/lib/roles";
import { createServiceClient } from "@/lib/supabase/admin";

function asText(value: unknown, max = 80) {
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
    kindId?: string;
    isActive?: boolean;
  };

  if (body.entity !== "persona" && body.entity !== "interest") {
    return NextResponse.json({ error: "Unknown catalog item." }, { status: 400 });
  }

  if (body.action === "remove") {
    if (!body.id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const table = body.entity === "persona" ? "personas" : "interests";
    const { error } = await service.from(table).update({ is_active: false }).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.action !== "save") {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const title = asText(body.title, 60);
  if (!title) {
    return NextResponse.json({ error: "A title is required." }, { status: 400 });
  }

  if (body.entity === "persona") {
    const subtitle = asText(body.subtitle, 120) || title;
    const payload = {
      title,
      subtitle,
      is_active: body.isActive !== false,
    };
    if (body.id) {
      const { error } = await service.from("personas").update(payload).eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    } else {
      const { count } = await service.from("personas").select("id", { count: "exact", head: true });
      const { error } = await service.from("personas").insert({
        ...payload,
        key: `${slugKey(title)}_${Date.now().toString(36)}`.slice(0, 40),
        sort_order: (count ?? 0) + 1,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  const kindId = asText(body.kindId, 64);
  if (!kindId) {
    return NextResponse.json({ error: "Pick a category." }, { status: 400 });
  }
  const payload = {
    title,
    activity_kind_id: kindId,
    is_active: body.isActive !== false,
  };
  if (body.id) {
    const { error } = await service.from("interests").update(payload).eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else {
    const { count } = await service
      .from("interests")
      .select("id", { count: "exact", head: true })
      .eq("activity_kind_id", kindId);
    const { error } = await service.from("interests").insert({
      ...payload,
      key: `${slugKey(title)}_${Date.now().toString(36)}`.slice(0, 40),
      sort_order: (count ?? 0) + 1,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
