import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { createServiceClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const session = await getStaffSession();
  if (!session || !isAdmin(session.role)) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const url = new URL(request.url);
  const interestId = url.searchParams.get("interestId") ?? "";
  const minRank = Number(url.searchParams.get("minRank") ?? "1");
  if (!interestId) return NextResponse.json({ matches: [], reason: "Pick an interest." });

  const service = createServiceClient();
  if (!service) return NextResponse.json({ matches: [], reason: "Supabase is not connected." });

  const { data: tagged, error: tagError } = await service
    .from("listing_interests")
    .select("listing_id")
    .eq("interest_id", interestId);
  if (tagError) return NextResponse.json({ error: tagError.message }, { status: 400 });

  const listingIds = [...new Set((tagged ?? []).map((row) => row.listing_id).filter(Boolean))];
  if (listingIds.length === 0) {
    return NextResponse.json({
      matches: [],
      summary: `No live listings are tagged with this interest yet.`,
    });
  }

  const { data: listings, error } = await service
    .from("directory_listings")
    .select(
      "id, name, suburb, city, status, is_suspended, listing_activity_scales ( is_primary, activity_scales ( rank ) )",
    )
    .in("id", listingIds)
    .eq("status", "approved")
    .eq("is_suspended", false)
    .order("name")
    .limit(40);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  type Row = {
    id: string;
    name: string;
    suburb: string | null;
    city: string | null;
    listing_activity_scales?: {
      is_primary: boolean | null;
      activity_scales: { rank: number | null } | { rank: number | null }[] | null;
    }[];
  };

  const matches = ((listings ?? []) as Row[])
    .map((row) => {
      const ranks = (row.listing_activity_scales ?? [])
        .map((entry) => {
          const scale = Array.isArray(entry.activity_scales)
            ? entry.activity_scales[0]
            : entry.activity_scales;
          return scale?.rank ?? null;
        })
        .filter((rank): rank is number => typeof rank === "number");
      const primary = (row.listing_activity_scales ?? []).find((entry) => entry.is_primary);
      const primaryScale = primary
        ? Array.isArray(primary.activity_scales)
          ? primary.activity_scales[0]
          : primary.activity_scales
        : null;
      const rank = primaryScale?.rank ?? ranks[0] ?? null;
      const why =
        rank === null
          ? "Tagged with the selected interest (no adventure level set)."
          : rank >= minRank
            ? `Interest match & adventure level ${rank} (≥ ${minRank}).`
            : `Interest match, but adventure level ${rank} is below ${minRank}.`;
      return {
        id: row.id,
        title: row.name,
        subtitle: [row.suburb, row.city].filter(Boolean).join(", ") || null,
        rank,
        qualifies: rank === null ? false : rank >= minRank,
        why,
      };
    })
    .filter((row) => row.qualifies)
    .slice(0, 24);

  return NextResponse.json({
    matches,
    summary: `Match activities in the selected interest at adventure level ${minRank} or above.`,
    totalQualified: matches.length,
  });
}
