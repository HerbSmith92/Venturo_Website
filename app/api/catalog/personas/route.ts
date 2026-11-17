import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";

export const revalidate = 300;

export async function GET() {
  const service = createServiceClient();
  if (!service) return NextResponse.json({ personas: [], contractVersion: "2026-11-17" });

  const { data, error } = await service
    .from("personas")
    .select("id, title, subtitle, image_path, sort_order")
    .eq("is_active", true)
    .order("sort_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json(
    {
      contractVersion: "2026-11-17",
      personas: (data ?? []).map((row) => ({
        id: row.id,
        name: row.title,
        description: row.subtitle,
        imageUrl: row.image_path,
        sortOrder: row.sort_order,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
  );
}
