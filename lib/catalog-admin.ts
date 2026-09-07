import { createServiceClient } from "@/lib/supabase/admin";

export type CatalogPersona = {
  id: string;
  key: string;
  title: string;
  subtitle: string;
  sort_order: number;
  is_active: boolean;
};

export type CatalogKind = {
  id: string;
  key: string;
  title: string;
};

export type CatalogInterest = {
  id: string;
  key: string;
  title: string;
  activity_kind_id: string;
  kind_title: string;
  sort_order: number;
  is_active: boolean;
};

export type CatalogAdmin = {
  personas: CatalogPersona[];
  interests: CatalogInterest[];
  kinds: CatalogKind[];
};

export async function loadCatalogAdmin(): Promise<CatalogAdmin> {
  const service = createServiceClient();
  if (!service) {
    return { personas: [], interests: [], kinds: [] };
  }

  const [personas, interests, kinds] = await Promise.all([
    service.from("personas").select("id, key, title, subtitle, sort_order, is_active").order("sort_order"),
    service
      .from("interests")
      .select("id, key, title, activity_kind_id, sort_order, is_active, activity_kinds ( title )")
      .order("sort_order")
      .order("title"),
    service.from("activity_kinds").select("id, key, title").eq("is_active", true).order("sort_order"),
  ]);

  type InterestRow = {
    id: string;
    key: string;
    title: string;
    activity_kind_id: string;
    sort_order: number;
    is_active: boolean;
    activity_kinds: { title: string } | { title: string }[] | null;
  };

  return {
    personas: (personas.data ?? []) as CatalogPersona[],
    kinds: (kinds.data ?? []) as CatalogKind[],
    interests: ((interests.data ?? []) as InterestRow[]).map((row) => {
      const kind = Array.isArray(row.activity_kinds) ? row.activity_kinds[0] : row.activity_kinds;
      return {
        id: row.id,
        key: row.key,
        title: row.title,
        activity_kind_id: row.activity_kind_id,
        kind_title: kind?.title ?? "Uncategorised",
        sort_order: row.sort_order,
        is_active: row.is_active,
      };
    }),
  };
}

export function slugKey(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return slug || "tag";
}
