import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { primaryItemKindForScreen } from "@/lib/app-home-content";
import { isAppHomeScreen } from "@/lib/app-home-types";
import { isAdmin } from "@/lib/roles";
import { createServiceClient } from "@/lib/supabase/admin";

function asText(value: unknown, max = 160) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

type ItemInput = {
  itemId?: string;
  itemKind?: string;
  sortOrder?: number;
  startsAt?: string | null;
  endsAt?: string | null;
};

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
    rowKind?: "hot" | "featured" | "custom";
    adminName?: string;
    publicTitle?: string | null;
    publicDescription?: string | null;
    selectionMode?: "manual" | "automatic" | "filter";
    selectionRules?: Record<string, unknown>;
    maxItems?: number;
    viewAllKind?: string | null;
    viewAllId?: string | null;
    viewAllUrl?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
    status?: "draft" | "published" | "archived";
    items?: ItemInput[];
  };

  if (!body.screen || !isAppHomeScreen(body.screen)) {
    return NextResponse.json({ error: "Unknown screen." }, { status: 400 });
  }

  if (body.action === "archive") {
    if (!body.id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const { data: existing } = await service
      .from("app_home_rows")
      .select("row_kind")
      .eq("id", body.id)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: "Row not found." }, { status: 404 });
    if (existing.row_kind === "hot" || existing.row_kind === "featured") {
      return NextResponse.json(
        { error: "Hot & Featured stay on the screen. Deactivate them instead of archiving." },
        { status: 400 },
      );
    }
    const { error } = await service
      .from("app_home_rows")
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

  if (body.action === "duplicate") {
    if (!body.id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const { data: source } = await service.from("app_home_rows").select("*").eq("id", body.id).maybeSingle();
    if (!source) return NextResponse.json({ error: "Row not found." }, { status: 404 });
    const { data: items } = await service
      .from("app_home_row_items")
      .select("*")
      .eq("row_id", body.id)
      .order("sort_order");
    const { count } = await service
      .from("app_home_rows")
      .select("id", { count: "exact", head: true })
      .eq("screen", body.screen)
      .neq("status", "archived");
    const { data: copy, error } = await service
      .from("app_home_rows")
      .insert({
        screen: body.screen,
        row_kind: "custom",
        admin_name: `${source.admin_name || source.public_title || "Row"} copy`,
        public_title: source.public_title,
        public_description: source.public_description,
        selection_mode: source.selection_mode,
        selection_rules: source.selection_rules ?? {},
        max_items: source.max_items,
        view_all_kind: source.view_all_kind,
        view_all_id: source.view_all_id,
        view_all_url: source.view_all_url,
        sort_order: (count ?? 0) + 1,
        status: "draft",
        is_active: false,
        starts_at: source.starts_at,
        ends_at: source.ends_at,
        updated_by: session.id,
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (items?.length) {
      await service.from("app_home_row_items").insert(
        items.map((item, index) => ({
          row_id: copy.id,
          item_kind: item.item_kind,
          item_id: item.item_id,
          sort_order: index + 1,
          starts_at: item.starts_at,
          ends_at: item.ends_at,
        })),
      );
    }
    return NextResponse.json({ ok: true, id: copy.id });
  }

  const rowKind = body.rowKind ?? "custom";
  const selectionMode =
    body.selectionMode ??
    (rowKind === "hot" ? "automatic" : rowKind === "featured" ? "manual" : "manual");
  const defaultKind = primaryItemKindForScreen(body.screen);

  const payload = {
    screen: body.screen,
    row_kind: rowKind,
    admin_name: asText(body.adminName, 80) || asText(body.publicTitle, 80) || "Row",
    public_title: asText(body.publicTitle, 80) || null,
    public_description: asText(body.publicDescription, 240) || null,
    selection_mode: selectionMode,
    selection_rules: body.selectionRules ?? {},
    max_items: Math.min(24, Math.max(1, Number(body.maxItems) || 12)),
    view_all_kind: body.viewAllKind || null,
    view_all_id: body.viewAllId || null,
    view_all_url: asText(body.viewAllUrl, 500) || null,
    sort_order: Number.isInteger(body.sortOrder) ? Math.max(1, Number(body.sortOrder)) : 100,
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

  let rowId = body.id;
  if (rowId) {
    const { error } = await service.from("app_home_rows").update(payload).eq("id", rowId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else {
    if (rowKind === "hot" || rowKind === "featured") {
      return NextResponse.json({ error: "Hot & Featured rows already exist per screen." }, { status: 400 });
    }
    const { data, error } = await service.from("app_home_rows").insert(payload).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    rowId = data.id;
  }

  if (Array.isArray(body.items)) {
    await service.from("app_home_row_items").delete().eq("row_id", rowId);
    const rows = body.items
      .filter((item) => item.itemId)
      .map((item, index) => ({
        row_id: rowId!,
        item_kind: item.itemKind || defaultKind,
        item_id: String(item.itemId),
        sort_order: Number.isInteger(item.sortOrder) ? Number(item.sortOrder) : index + 1,
        starts_at: item.startsAt || null,
        ends_at: item.endsAt || null,
      }));
    if (rows.length) {
      const { error } = await service.from("app_home_row_items").insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  await service.from("app_home_revisions").insert({
    screen: body.screen,
    entity_kind: "row",
    entity_id: rowId,
    action: body.status === "published" ? "publish" : body.id ? "save" : "create",
    snapshot: { ...payload, items: body.items ?? [] },
    actor_id: session.id,
  });

  return NextResponse.json({ ok: true, id: rowId });
}
