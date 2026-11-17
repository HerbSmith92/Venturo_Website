import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";

export const revalidate = 300;

export async function GET() {
  const service = createServiceClient();
  if (!service) return NextResponse.json({ levels: [], contractVersion: "2026-11-17" });

  const { data, error } = await service
    .from("activity_scales")
    .select("id, key, title, subtitle, rank, image_path")
    .eq("is_active", true)
    .order("rank");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json(
    {
      contractVersion: "2026-11-17",
      levels: (data ?? []).map((row) => ({
        id: row.id,
        key: row.key,
        name: row.title,
        description: row.subtitle,
        rank: row.rank,
        imageUrl: row.image_path,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
  );
}
