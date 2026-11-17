import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";

export const revalidate = 300;

export async function GET() {
  const service = createServiceClient();
  if (!service) return NextResponse.json({ interests: [], contractVersion: "2026-11-17" });
  const full = await service
    .from("interests")
    .select("id, title, description, icon_url, sort_order, activity_kind_id, activity_kinds(key, title)")
    .eq("is_active", true)
    .order("sort_order")
    .order("title");
  const fallback = full.error
    ? await service
        .from("interests")
        .select("id, title, activity_kind_id, activity_kinds(key, title)")
        .eq("is_active", true)
        .order("title")
    : null;
  const rows = full.error ? fallback?.data ?? [] : full.data ?? [];
  return NextResponse.json(
    {
      contractVersion: "2026-11-17",
      interests: rows.map((row) => {
        const kind = Array.isArray(row.activity_kinds) ? row.activity_kinds[0] : row.activity_kinds;
        return {
          id: row.id,
          name: row.title,
          description: "description" in row ? row.description : null,
          iconUrl: "icon_url" in row ? row.icon_url : null,
          sortOrder: "sort_order" in row ? row.sort_order : 0,
          kind: kind ? { id: row.activity_kind_id, key: kind.key, name: kind.title } : null,
        };
      }),
    },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
  );
}
