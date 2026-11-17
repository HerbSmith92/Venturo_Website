import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";

export const revalidate = 60;

export async function GET() {
  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ token: null, contractVersion: "2026-11-17" });
  }

  const { data } = await service
    .from("wallet_token_artwork")
    .select("id, image_path, published_at")
    .eq("status", "published")
    .maybeSingle();

  return NextResponse.json(
    {
      contractVersion: "2026-11-17",
      token: data
        ? {
            id: data.id,
            imageUrl: data.image_path,
            publishedAt: data.published_at,
          }
        : null,
    },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  );
}
