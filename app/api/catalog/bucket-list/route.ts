import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";

export const revalidate = 300;

export async function GET() {
  const service = createServiceClient();
  if (!service) return NextResponse.json({ items: [], contractVersion: "2026-11-17" });

  const { data, error } = await service
    .from("bucket_items")
    .select(
      "id, key, title, description, image_path, sort_order, typical_scale_rank, interest_id, activity_kind_id, interests ( title )",
    )
    .eq("is_active", true)
    .order("sort_order")
    .order("title");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json(
    {
      contractVersion: "2026-11-17",
      items: (data ?? []).map((row) => {
        const interest = Array.isArray(row.interests) ? row.interests[0] : row.interests;
        return {
          id: row.id,
          key: row.key,
          name: row.title,
          description: row.description,
          imageUrl: row.image_path,
          sortOrder: row.sort_order,
          interestId: row.interest_id,
          kindId: row.activity_kind_id,
          minAdventureRank: row.typical_scale_rank,
          ruleSummary: `Match activities in ${interest?.title ?? "the selected interest"} at adventure level ${row.typical_scale_rank} or above.`,
        };
      }),
    },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
  );
}
