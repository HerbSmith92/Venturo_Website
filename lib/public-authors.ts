import { AUTHOR_SELECT, mapGuideAuthor, type GuideAuthor, type GuideAuthorPublic } from "@/lib/guide-authors";
import { liveGuides } from "@/lib/guides";
import { createClient } from "@/lib/supabase/server";

export type PublicAuthorListItem = GuideAuthorPublic & {
  guideCount: number;
};

function isPublicAuthor(row: GuideAuthor) {
  return row.display_name.trim() !== "" && row.display_name !== "Untitled Author" && Boolean(row.slug);
}

export async function listPublicAuthors(): Promise<PublicAuthorListItem[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const [{ data, error }, guides] = await Promise.all([
    supabase.from("guide_authors").select(AUTHOR_SELECT).order("display_name"),
    liveGuides(),
  ]);
  if (error || !data) return [];
  const counts = new Map<string, number>();
  for (const guide of guides) {
    if (!guide.authorId) continue;
    counts.set(guide.authorId, (counts.get(guide.authorId) ?? 0) + 1);
  }
  return (data as GuideAuthor[])
    .filter(isPublicAuthor)
    .map((row) => ({
      ...mapGuideAuthor(row),
      guideCount: counts.get(row.id) ?? 0,
    }));
}

export async function getPublicAuthorBySlug(slug: string): Promise<GuideAuthorPublic | null> {
  const supabase = await createClient();
  if (!supabase || !slug) return null;
  const { data, error } = await supabase
    .from("guide_authors")
    .select(AUTHOR_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as GuideAuthor;
  if (!isPublicAuthor(row)) return null;
  return mapGuideAuthor(row);
}
