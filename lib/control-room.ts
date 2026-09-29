import { isListingStatus, type ListingStatus } from "@/lib/control-room-shared";
import type { ListingDetail, QueueListing } from "@/lib/control-room-types";
import { getMemberAccessMap } from "@/lib/member-access";
import { roleFromAppMetadata, type AppRole } from "@/lib/roles";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export {
  LISTING_STATUSES,
  LISTING_ACTIONS,
  isListingStatus,
  isListingAction,
  listingStatusLabel,
  formatRand,
  formatClock,
  formatDay,
  formatHours,
} from "@/lib/control-room-shared";
export type { ListingStatus, ListingAction, AuditEvent } from "@/lib/control-room-shared";
export type { ListingDetail, QueueListing } from "@/lib/control-room-types";

type CountArgs = { status?: string };

async function countRows(table: string, filter?: CountArgs) {
  const supabase = await createClient();
  if (!supabase) return 0;
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  if (filter?.status) query = query.eq("status", filter.status);
  const { count } = await query;
  return count ?? 0;
}

export async function controlRoomStats() {
  const [live, review, draft, archived, members, enquiries, eventsReview] = await Promise.all([
    countRows("directory_listings", { status: "approved" }),
    countRows("directory_listings", { status: "review" }),
    countRows("directory_listings", { status: "draft" }),
    countRows("directory_listings", { status: "archived" }),
    countRows("profiles"),
    countRows("enquiries"),
    countRows("events", { status: "review" }),
  ]);

  return {
    live,
    review,
    draft,
    archived,
    members,
    enquiries,
    eventsReview,
    listings: live + review + draft + archived,
  };
}

export async function loadQueue(status?: string, q?: string): Promise<QueueListing[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  let query = supabase
    .from("directory_listings")
    .select(
      "id, name, branch_name, slug, suburb, city, status, is_featured, is_suspended, review_note, publish_at, price_from, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  if (status === "suspended") query = query.eq("is_suspended", true);
  else if (status === "scheduled") {
    query = query.eq("status", "approved").eq("is_suspended", false).gt("publish_at", new Date().toISOString());
  } else if (status && isListingStatus(status)) {
    query = query.eq("status", status);
    if (status === "approved") query = query.eq("is_suspended", false);
  }
  if (q?.trim()) query = query.ilike("name", `%${q.trim()}%`);

  const { data, error } = await query;
  if (error) {
    if (!/is_suspended|review_note|publish_at/.test(error.message)) return [];
    let fallback = supabase
      .from("directory_listings")
      .select("id, name, branch_name, slug, suburb, city, status, is_featured, price_from, updated_at")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (status && isListingStatus(status)) fallback = fallback.eq("status", status);
    if (q?.trim()) fallback = fallback.ilike("name", `%${q.trim()}%`);
    const second = await fallback;
    return (second.data ?? []) as QueueListing[];
  }
  if (!data) return [];
  return data as QueueListing[];
}

type KindEmbed = { key?: string | null; title?: string | null } | { key?: string | null; title?: string | null }[] | null;

type DirectoryQueryRow = QueueListing & {
  listing_media?: {
    public_url: string | null;
    is_cover: boolean | null;
    sort_order: number | null;
    is_pending?: boolean | null;
  }[] | null;
  listing_activity_kinds?: { is_primary: boolean | null; activity_kinds: KindEmbed }[] | null;
};

function kindTitle(entry: { activity_kinds: KindEmbed } | undefined) {
  const kind = entry?.activity_kinds;
  if (!kind) return null;
  const row = Array.isArray(kind) ? kind[0] : kind;
  return row?.title?.trim() || null;
}

function kindKeyOf(entry: { activity_kinds: KindEmbed } | undefined) {
  const kind = entry?.activity_kinds;
  if (!kind) return null;
  const row = Array.isArray(kind) ? kind[0] : kind;
  return row?.key?.trim() || null;
}

function queueCoverUrl(media: DirectoryQueryRow["listing_media"]) {
  const rows = [...(media ?? [])].filter((row) => !row.is_pending).sort((a, b) => {
    if (a.is_cover !== b.is_cover) return a.is_cover ? -1 : 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  return rows.find((row) => row.public_url)?.public_url ?? null;
}

export async function loadDirectoryQueue(filters: {
  status?: string;
  q?: string;
  interest?: string;
  author?: string;
  sort?: string;
  dir?: string;
}): Promise<{
  rows: QueueListing[];
  interests: { key: string; title: string }[];
  authors: string[];
}> {
  const supabase = await createClient();
  if (!supabase) return { rows: [], interests: [], authors: [] };

  const status = filters.status === "all" ? "" : filters.status;
  let query = supabase
    .from("directory_listings")
    .select(
      `
      id, name, branch_name, slug, suburb, city, status, is_featured, is_suspended, review_note, publish_at, price_from, updated_at,
      listing_media ( public_url, is_cover, sort_order, is_pending ),
      listing_activity_kinds ( is_primary, activity_kinds ( key, title ) )
    `,
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  if (status === "suspended") query = query.eq("is_suspended", true);
  else if (status === "scheduled") {
    query = query
      .eq("status", "approved")
      .eq("is_suspended", false)
      .gt("publish_at", new Date().toISOString());
  } else if (status && isListingStatus(status)) {
    query = query.eq("status", status);
    if (status === "approved") query = query.eq("is_suspended", false);
  }
  if (filters.q?.trim()) query = query.ilike("name", `%${filters.q.trim()}%`);

  const { data, error } = await query;
  if (error || !data) return { rows: [], interests: [], authors: [] };

  const base = data as DirectoryQueryRow[];
  const ids = base.map((row) => row.id);
  const authorByListing = new Map<string, string>();
  if (ids.length > 0) {
    const audit = await supabase
      .from("listing_audit_events")
      .select("listing_id, actor_id, created_at")
      .in("listing_id", ids)
      .order("created_at", { ascending: false });
    const latestActor = new Map<string, string>();
    for (const event of audit.data ?? []) {
      if (!latestActor.has(event.listing_id)) latestActor.set(event.listing_id, event.actor_id);
    }
    const actorIds = [...new Set(latestActor.values())];
    if (actorIds.length > 0) {
      const profiles = await supabase.from("profiles").select("id, display_name").in("id", actorIds);
      const names = new Map(
        (profiles.data ?? []).map((profile) => [profile.id, (profile.display_name ?? "").trim()]),
      );
      for (const [listingId, actorId] of latestActor) {
        const name = names.get(actorId);
        if (name) authorByListing.set(listingId, name);
      }
    }
  }

  const mapped = base.map((row) => {
    const kinds = [...(row.listing_activity_kinds ?? [])].sort(
      (a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)),
    );
    const primary = kinds[0];
    return {
      ...row,
      cover_url: queueCoverUrl(row.listing_media),
      interest: kindTitle(primary),
      interest_key: kindKeyOf(primary),
      author: authorByListing.get(row.id) ?? null,
    } satisfies QueueListing;
  });

  const interests = new Map<string, string>();
  const authors = new Set<string>();
  for (const row of mapped) {
    if (row.interest_key && row.interest) interests.set(row.interest_key, row.interest);
    if (row.author) authors.add(row.author);
  }

  const interest = filters.interest?.trim();
  const author = filters.author?.trim().toLowerCase();
  const rows = mapped.filter((row) => {
    if (interest && row.interest_key !== interest) return false;
    if (author && (row.author ?? "").toLowerCase() !== author) return false;
    return true;
  });

  const sort =
    filters.sort === "name" || filters.sort === "interest" || filters.sort === "author" || filters.sort === "updated"
      ? filters.sort
      : "updated";
  const ascending = filters.dir ? filters.dir === "asc" : sort !== "updated";
  rows.sort((a, b) => {
    const text = (left: string | null | undefined, right: string | null | undefined) =>
      (left ?? "\uffff").localeCompare(right ?? "\uffff", "en", { sensitivity: "base" });
    let delta = 0;
    if (sort === "name") delta = text(a.name, b.name);
    else if (sort === "interest") delta = text(a.interest, b.interest);
    else if (sort === "author") delta = text(a.author, b.author);
    else delta = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
    return ascending ? delta : -delta;
  });

  return {
    rows,
    interests: [...interests.entries()]
      .map(([key, title]) => ({ key, title }))
      .sort((a, b) => a.title.localeCompare(b.title)),
    authors: [...authors].sort((a, b) => a.localeCompare(b)),
  };
}

export async function loadListing(id: string): Promise<ListingDetail | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("directory_listings")
    .select(
      `
      id, business_id, name, branch_name, slug, suburb, city, status, is_featured, is_suspended, review_note, publish_at, price_from, updated_at,
      short_description, description, phone, email, website_url, booking_url,
      street_address_1, street_address_2, province, postal_code,
      latitude, longitude, maps_url,
      booking_required, indoor_outdoor, interest_keywords, persona_keywords, google_rating, google_review_count,
      authorised_to_submit, image_rights_granted, terms_accepted,
      published_at, last_verified_at,
      businesses ( id, name, slug, status, description, website_url ),
      listing_revisions ( payload, state ),
      listing_media ( id, public_url, is_cover, sort_order, alt_text, storage_key, is_pending ),
      listing_activities!listing_activities_listing_id_fkey (
        id, name, slug, short_description, description,
        duration_minutes, minimum_age, maximum_age, booking_required,
        sort_order, status, show_on_discover, show_on_from
      ),
      operating_hours ( id, day_of_week, opens_at, closes_at, is_closed, vacation_opens_at, vacation_closes_at, vacation_is_closed ),
      price_options (
        id, listing_activity_id, name, standard_price, member_price, inclusions,
        applies_to, price_category, valid_from, valid_until, is_active, show_on_from, sort_order,
        minimum_group_size, discount_rand, discount_percent
      ),
      listing_personas ( persona_id, is_primary ),
      listing_interests ( interest_id, is_primary ),
      listing_activity_scales ( activity_scale_id, is_primary ),
      listing_activity_kinds ( activity_kind_id, is_primary ),
      social_links ( id, platform, handle, url, is_primary )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[loadListing]", id, error.message, error.details, error.hint);
    }
    return null;
  }
  const loaded = data as ListingDetail & {
    listing_revisions?:
      | { payload?: unknown; state?: string }
      | { payload?: unknown; state?: string }[]
      | null;
  };
  const revisionRow = Array.isArray(loaded.listing_revisions)
    ? loaded.listing_revisions[0]
    : loaded.listing_revisions;
  const pendingState =
    revisionRow?.state === "draft" || revisionRow?.state === "review" ? revisionRow.state : null;
  const { listing_revisions: _revision, ...row } = loaded;
  return {
    ...row,
    pending_payload: pendingState ? (revisionRow?.payload ?? null) : null,
    pending_state: pendingState,
    listing_media: row.listing_media ?? [],
    listing_activities: row.listing_activities ?? [],
    operating_hours: row.operating_hours ?? [],
    price_options: row.price_options ?? [],
    listing_personas: row.listing_personas ?? [],
    listing_interests: row.listing_interests ?? [],
    listing_activity_scales: row.listing_activity_scales ?? [],
    listing_activity_kinds: row.listing_activity_kinds ?? [],
    social_links: row.social_links ?? [],
  };
}

export async function loadEditorBranches(businessId: string) {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("directory_listings")
    .select(
      "id, name, branch_name, status, suburb, city, price_from, listing_media ( public_url, is_cover, sort_order, is_pending )",
    )
    .eq("business_id", businessId)
    .order("name");

  type BranchRow = {
    id: string;
    name: string;
    branch_name: string | null;
    status: ListingStatus;
    suburb: string | null;
    city: string | null;
    price_from: number | string | null;
    listing_media?: {
      public_url: string | null;
      is_cover: boolean | null;
      sort_order: number | null;
      is_pending?: boolean | null;
    }[];
  };

  return ((data ?? []) as BranchRow[]).map((row) => {
    const media = [...(row.listing_media ?? [])].filter((item) => !item.is_pending).sort((a, b) => {
      if (a.is_cover !== b.is_cover) return a.is_cover ? -1 : 1;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
    return {
      id: row.id,
      name: row.name,
      branch_name: row.branch_name,
      status: row.status,
      suburb: row.suburb,
      city: row.city,
      price_from: row.price_from,
      cover_url: media.find((item) => item.public_url)?.public_url ?? null,
    };
  });
}

export async function loadEditorCatalog() {
  const supabase = await createClient();
  if (!supabase) {
    return { personas: [], scales: [], kinds: [], interests: [] };
  }

  const [personas, scales, kinds, interests] = await Promise.all([
    supabase.from("personas").select("id, title").eq("is_active", true).order("sort_order"),
    supabase
      .from("activity_scales")
      .select("id, title, subtitle")
      .eq("is_active", true)
      .order("rank"),
    supabase
      .from("activity_kinds")
      .select("id, key, title")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("interests")
      .select("id, title, activity_kinds ( key, title )")
      .eq("is_active", true)
      .order("title"),
  ]);

  type InterestRow = {
    id: string;
    title: string;
    activity_kinds: { key: string; title: string } | { key: string; title: string }[] | null;
  };

  const mappedInterests = ((interests.data ?? []) as InterestRow[]).map((row) => {
    const kind = Array.isArray(row.activity_kinds) ? row.activity_kinds[0] : row.activity_kinds;
    return {
      id: row.id,
      title: row.title,
      kind_key: kind?.key ?? "adventure",
      kind_title: kind?.title ?? "Adventure",
    };
  });

  return {
    personas: (personas.data ?? []) as { id: string; title: string }[],
    scales: (scales.data ?? []) as { id: string; title: string; subtitle: string }[],
    kinds: (kinds.data ?? []) as { id: string; key: string; title: string }[],
    interests: mappedInterests,
  };
}

export async function loadAudit(listingId: string) {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("listing_audit_events")
    .select("id, action, from_status, to_status, created_at, actor_id, before, after")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false })
    .limit(30);
  const rows = data ?? [];
  const actorIds = [...new Set(rows.map((row) => row.actor_id).filter(Boolean))];
  const names = new Map<string, string>();
  if (actorIds.length > 0) {
    const profiles = await supabase
      .from("profiles")
      .select("id, display_name, last_name")
      .in("id", actorIds);
    for (const profile of profiles.data ?? []) {
      const name = [profile.display_name, profile.last_name].filter(Boolean).join(" ").trim();
      if (name) names.set(profile.id, name);
    }
  }
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    from_status: row.from_status,
    to_status: row.to_status,
    created_at: row.created_at,
    actor_name: names.get(row.actor_id) || "Unknown author",
    before: (row.before ?? null) as Record<string, unknown> | null,
    after: (row.after ?? null) as Record<string, unknown> | null,
  }));
}

export type EnquiryRow = {
  id: string;
  kind: string;
  name: string;
  email: string;
  phone: string | null;
  business_name: string | null;
  area: string | null;
  message: string;
  created_at: string;
};

export async function loadEnquiries(): Promise<EnquiryRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("enquiries")
    .select("id, kind, name, email, phone, business_name, area, message, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as EnquiryRow[];
}

export type MemberRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  role: AppRole | null;
  plan: "free" | "paid";
  onboarding_step: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
};

function filterMembers(members: MemberRow[], query?: string) {
  const needle = query?.trim().toLowerCase() ?? "";
  const filtered = needle
    ? members.filter(
        (member) =>
          (member.display_name ?? "").toLowerCase().includes(needle) ||
          (member.email ?? "").toLowerCase().includes(needle) ||
          (member.role ?? "").toLowerCase().includes(needle),
      )
    : members;
  return filtered.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

async function loadMembersFromProfiles(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  query?: string,
) {
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, onboarding_step, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const ids = (data ?? []).map((row) => row.id as string);
  const paidMap = ids.length ? await getMemberAccessMap(ids) : new Map<string, boolean>();

  const members = (data ?? []).map(
    (row): MemberRow => ({
      id: row.id,
      display_name: row.display_name,
      email: null,
      role: null,
      plan: paidMap.get(row.id) ? "paid" : "free",
      onboarding_step: row.onboarding_step,
      created_at: row.created_at,
      last_sign_in_at: null,
      email_confirmed: true,
    }),
  );

  return filterMembers(members, query);
}

export async function loadMembers(query?: string): Promise<{
  members: MemberRow[];
  serviceRoleReady: boolean;
  loadError: string | null;
}> {
  const admin = createServiceClient();
  const supabase = await createClient();
  const serviceRoleReady = Boolean(admin);

  if (!supabase) {
    return { members: [], serviceRoleReady, loadError: "Supabase is not connected." };
  }

  if (!admin) {
    const members = await loadMembersFromProfiles(supabase, query);
    return {
      members,
      serviceRoleReady,
      loadError: "SUPABASE_SERVICE_ROLE_KEY is missing from the running server.",
    };
  }

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error || !data?.users) {
    const members = await loadMembersFromProfiles(supabase, query);
    return {
      members,
      serviceRoleReady,
      loadError: error?.message ?? "Could not list auth users.",
    };
  }

  const users = data.users;
  const ids = users.map((user) => user.id);
  const [{ data: profiles }, paidMap] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, onboarding_step, created_at")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    getMemberAccessMap(ids),
  ]);

  const profileById = new Map(
    (profiles ?? []).map((row) => [
      row.id as string,
      row as {
        id: string;
        display_name: string | null;
        onboarding_step: string;
        created_at: string;
      },
    ]),
  );

  const members = users.map((user): MemberRow => {
    const profile = profileById.get(user.id);
    const meta = user.user_metadata as { first_name?: string } | undefined;
    const paid = Boolean(paidMap.get(user.id));
    return {
      id: user.id,
      display_name: profile?.display_name || meta?.first_name || null,
      email: user.email ?? null,
      role: roleFromAppMetadata(user.app_metadata),
      plan: paid ? "paid" : "free",
      onboarding_step: profile?.onboarding_step ?? "identity",
      created_at: profile?.created_at ?? user.created_at,
      last_sign_in_at: user.last_sign_in_at ?? null,
      email_confirmed: Boolean(user.email_confirmed_at),
    };
  });

  return {
    members: filterMembers(members, query),
    serviceRoleReady,
    loadError: null,
  };
}

export function businessName(listing: ListingDetail) {
  const biz = listing.businesses;
  if (!biz) return "—";
  return Array.isArray(biz) ? biz[0]?.name ?? "—" : biz.name;
}

export function coverUrl(listing: ListingDetail) {
  const media = [...(listing.listing_media ?? [])].filter((row) => !row.is_pending).sort((a, b) => {
    if (a.is_cover !== b.is_cover) return a.is_cover ? -1 : 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  return media.find((item) => item.public_url)?.public_url ?? null;
}
