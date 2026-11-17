import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";

export const revalidate = 300;

function withCacheBust(url: string | null | undefined, version: number | null | undefined) {
  if (!url) return null;
  if (!version) return url;
  const join = url.includes("?") ? "&" : "?";
  return `${url}${join}v=${version}`;
}

export async function GET() {
  const service = createServiceClient();
  if (!service) return NextResponse.json({ interests: [], contractVersion: "2026-11-17" });

  const full = await service
    .from("interests")
    .select(
      "id, title, description, icon_path, image_path, icon_version, sort_order, activity_kind_id, activity_kinds(key, title)",
    )
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
        const icon =
          "icon_path" in row
            ? (row.icon_path as string | null)
            : "image_path" in row
              ? (row.image_path as string | null)
              : null;
        const version = "icon_version" in row ? (row.icon_version as number | null) : null;
        return {
          id: row.id,
          name: row.title,
          description: "description" in row ? row.description : null,
          iconUrl: withCacheBust(icon, version),
          sortOrder: "sort_order" in row ? row.sort_order : 0,
          kind: kind ? { id: row.activity_kind_id, key: kind.key, name: kind.title } : null,
        };
      }),
    },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
  );
}
