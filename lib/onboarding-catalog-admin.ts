import { createServiceClient } from "@/lib/supabase/admin";

export type AdventureLevelAdmin = {
  id: string;
  key: string;
  title: string;
  subtitle: string;
  rank: number;
  is_active: boolean;
  image_path: string | null;
};

export type BucketItemAdmin = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  activity_kind_id: string;
  interest_id: string;
  typical_scale_rank: number;
  sort_order: number;
  is_active: boolean;
  image_path: string | null;
  interest_title: string;
  kind_title: string;
};

export type OnboardingCatalogAdmin = {
  scales: AdventureLevelAdmin[];
  bucketItems: BucketItemAdmin[];
  kinds: { id: string; key: string; title: string }[];
  interests: { id: string; title: string; activity_kind_id: string }[];
};

export async function loadOnboardingCatalogAdmin(): Promise<OnboardingCatalogAdmin> {
  const service = createServiceClient();
  if (!service) {
    return { scales: [], bucketItems: [], kinds: [], interests: [] };
  }

  const [scales, bucketItems, kinds, interests] = await Promise.all([
    service
      .from("activity_scales")
      .select("id, key, title, subtitle, rank, is_active, image_path")
      .order("rank"),
    service
      .from("bucket_items")
      .select(
        "id, key, title, description, activity_kind_id, interest_id, typical_scale_rank, sort_order, is_active, image_path, interests ( title ), activity_kinds ( title )",
      )
      .order("sort_order")
      .order("title"),
    service.from("activity_kinds").select("id, key, title").eq("is_active", true).order("sort_order"),
    service
      .from("interests")
      .select("id, title, activity_kind_id")
      .eq("is_active", true)
      .order("sort_order")
      .order("title"),
  ]);

  type BucketRow = {
    id: string;
    key: string;
    title: string;
    description: string | null;
    activity_kind_id: string;
    interest_id: string;
    typical_scale_rank: number;
    sort_order: number;
    is_active: boolean;
    image_path: string | null;
    interests: { title: string } | { title: string }[] | null;
    activity_kinds: { title: string } | { title: string }[] | null;
  };

  return {
    scales: ((scales.data ?? []) as AdventureLevelAdmin[]).map((row) => ({
      ...row,
      image_path: row.image_path ?? null,
      subtitle: row.subtitle ?? "",
    })),
    kinds: (kinds.data ?? []) as OnboardingCatalogAdmin["kinds"],
    interests: (interests.data ?? []) as OnboardingCatalogAdmin["interests"],
    bucketItems: ((bucketItems.data ?? []) as BucketRow[]).map((row) => {
      const interest = Array.isArray(row.interests) ? row.interests[0] : row.interests;
      const kind = Array.isArray(row.activity_kinds) ? row.activity_kinds[0] : row.activity_kinds;
      return {
        id: row.id,
        key: row.key,
        title: row.title,
        description: row.description ?? null,
        activity_kind_id: row.activity_kind_id,
        interest_id: row.interest_id,
        typical_scale_rank: row.typical_scale_rank,
        sort_order: row.sort_order,
        is_active: row.is_active,
        image_path: row.image_path ?? null,
        interest_title: interest?.title ?? "Interest",
        kind_title: kind?.title ?? "Category",
      };
    }),
  };
}

export function bucketRuleSummary(item: {
  interest_title: string;
  typical_scale_rank: number;
  kind_title?: string;
}): string {
  return `Match activities in ${item.interest_title} at adventure level ${item.typical_scale_rank} or above.`;
}
