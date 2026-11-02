import { AUTHOR_SELECT, type AuthorLatestGuide, type GuideAuthor } from "@/lib/guide-authors";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type GuideStaffOption = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  linkedAuthorId: string | null;
};

export type GuideAuthorRow = GuideAuthor & {
  email: string | null;
  loginLabel: string | null;
  publishedCount: number;
};

export type GuideAuthorInviteRow = {
  id: string;
  email: string | null;
  token: string;
  created_at: string;
  expires_at: string;
  claimed_at: string | null;
};

export async function loadGuideAuthors(): Promise<GuideAuthor[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("guide_authors")
    .select(AUTHOR_SELECT)
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return data as GuideAuthor[];
}

async function publishedCountsByAuthor() {
  const supabase = await createClient();
  const counts = new Map<string, number>();
  if (!supabase) return counts;
  const [listing, event] = await Promise.all([
    supabase.from("curated_guides").select("author_id").eq("status", "published").not("author_id", "is", null),
    supabase.from("curated_event_guides").select("author_id").eq("status", "published").not("author_id", "is", null),
  ]);
  for (const row of [...(listing.data ?? []), ...(event.data ?? [])]) {
    const id = (row as { author_id?: string | null }).author_id;
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

async function loadGuideAuthorInvites(): Promise<GuideAuthorInviteRow[]> {
  const admin = createServiceClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("guide_author_invites")
    .select("id, email, token, created_at, expires_at, claimed_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return data as GuideAuthorInviteRow[];
}

export async function loadGuideAuthorsDashboard(): Promise<{
  authors: GuideAuthorRow[];
  invites: GuideAuthorInviteRow[];
}> {
  const [authors, staff, counts, invites] = await Promise.all([
    loadGuideAuthors(),
    loadGuideStaffOptions(),
    publishedCountsByAuthor(),
    loadGuideAuthorInvites(),
  ]);
  const staffById = new Map(staff.map((person) => [person.id, person]));
  return {
    authors: authors.map((author) => {
      const linked = author.user_id ? staffById.get(author.user_id) : undefined;
      return {
        ...author,
        email: linked?.email ?? null,
        loginLabel: linked ? `${linked.role}` : author.user_id ? "member" : null,
        publishedCount: counts.get(author.id) ?? 0,
      };
    }),
    invites,
  };
}

export async function loadGuideAuthor(id: string): Promise<GuideAuthor | null> {
  const supabase = await createClient();
  if (!supabase || !id) return null;
  const { data, error } = await supabase
    .from("guide_authors")
    .select(AUTHOR_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as GuideAuthor;
}

export async function loadGuideStaffOptions(): Promise<GuideStaffOption[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const [{ data, error }, linked] = await Promise.all([
    supabase.rpc("admin_list_guide_staff"),
    supabase.from("guide_authors").select("id, user_id").not("user_id", "is", null),
  ]);
  if (error || !data) return [];
  const byUser = new Map(
    (linked.data ?? [])
      .filter((row): row is { id: string; user_id: string } => Boolean(row.user_id))
      .map((row) => [row.user_id, row.id]),
  );
  return (data as Omit<GuideStaffOption, "linkedAuthorId">[]).map((person) => ({
    ...person,
    linkedAuthorId: byUser.get(person.id) ?? null,
  }));
}

export async function loadLatestPublishedGuideForAuthor(
  authorId: string,
): Promise<AuthorLatestGuide | null> {
  const supabase = await createClient();
  if (!supabase || !authorId) return null;
  const [listing, event] = await Promise.all([
    supabase
      .from("curated_guides")
      .select("title, slug, publish_at, updated_at")
      .eq("author_id", authorId)
      .eq("status", "published")
      .order("publish_at", { ascending: false, nullsFirst: false })
      .limit(1),
    supabase
      .from("curated_event_guides")
      .select("title, slug, publish_at, updated_at")
      .eq("author_id", authorId)
      .eq("status", "published")
      .order("publish_at", { ascending: false, nullsFirst: false })
      .limit(1),
  ]);
  type Row = { title: string; slug: string; publish_at: string | null; updated_at: string | null };
  const listingRow = (listing.data?.[0] as Row | undefined) ?? null;
  const eventRow = (event.data?.[0] as Row | undefined) ?? null;
  const stamp = (row: Row | null) => Date.parse(row?.publish_at || row?.updated_at || "") || 0;
  const pick = stamp(eventRow) > stamp(listingRow) ? eventRow : listingRow;
  if (!pick?.title || !pick.slug) return null;
  return { title: pick.title, href: `/guides/${pick.slug}`, image: null };
}

export async function linkedAuthorIdForUser(userId: string): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase || !userId) return null;
  const { data } = await supabase
    .from("guide_authors")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}
