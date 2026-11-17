import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";

export const revalidate = 60;

export async function GET() {
  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ achievements: [], contractVersion: "2026-11-17" });
  }

  const { data, error } = await service
    .from("achievements")
    .select(
      "id, key, name, description, image_path, tier, criteria_kind, criteria, criteria_summary, token_reward, sort_order",
    )
    .eq("status", "published")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json(
    {
      contractVersion: "2026-11-17",
      achievements: (data ?? []).map((row) => ({
        id: row.id,
        key: row.key,
        name: row.name,
        description: row.description,
        imageUrl: row.image_path,
        tier: row.tier,
        criteriaKind: row.criteria_kind,
        criteria: row.criteria,
        ruleSummary: row.criteria_summary,
        tokenReward: row.token_reward,
        sortOrder: row.sort_order,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  );
}
