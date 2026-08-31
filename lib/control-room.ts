import { revenueCatIsConfigured } from "@/lib/brand";
import { isListingStatus, type ListingStatus } from "@/lib/control-room-shared";
import type { ListingDetail, QueueListing } from "@/lib/control-room-types";
import { getPaidMembershipMap } from "@/lib/revenuecat";
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

type CountArgs = { status?: ListingStatus };

async function countRows(table: string, filter?: CountArgs) {
  const supabase = await createClient();
  if (!supabase) return 0;
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  if (filter?.status) query = query.eq("status", filter.status);
  const { count } = await query;
  return count ?? 0;
}

export async function controlRoomStats() {
  const [live, review, draft, archived, members, enquiries] = await Promise.all([
    countRows("directory_listings", { status: "approved" }),
    countRows("directory_listings", { status: "review" }),
    countRows("directory_listings", { status: "draft" }),
    countRows("directory_listings", { status: "archived" }),
    countRows("profiles"),
    countRows("enquiries"),
  ]);

  return { live, review, draft, archived, members, enquiries, listings: live + review + draft + archived };
}

export async function loadQueue(status?: string, q?: string): Promise<QueueListing[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  let query = supabase
    .from("directory_listings")
    .select("id, name, branch_name, slug, suburb, city, status, is_featured, price_from, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (status && isListingStatus(status)) query = query.eq("status", status);
  if (q?.trim()) query = query.ilike("name", `%${q.trim()}%`);

  const { data, error } = await query;
  if (error || !data) return [];
  return data as QueueListing[];
}

export async function loadListing(id: string): Promise<ListingDetail | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("directory_listings")
    .select(
      `
      id, business_id, name, branch_name, slug, suburb, city, status, is_featured, price_from, updated_at,
      short_description, description, phone, email, website_url, booking_url,
      street_address_1, street_address_2, province, postal_code,
      booking_required, indoor_outdoor, google_rating,
      authorised_to_submit, image_rights_granted,
      published_at, last_verified_at,
      businesses ( id, name, slug, status, description, website_url ),
      listing_media ( id, public_url, is_cover, sort_order, alt_text, storage_key ),
      listing_activities!listing_activities_listing_id_fkey (
        id, name, slug, short_description, description,
        duration_minutes, minimum_age, maximum_age, booking_required,
        sort_order, status
      ),
      operating_hours ( id, day_of_week, opens_at, closes_at, is_closed ),
      price_options (
        id, listing_activity_id, name, standard_price, member_price, inclusions,
        applies_to, price_category, valid_from, valid_until, is_active, sort_order
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
  const row = data as ListingDetail;
  return {
    ...row,
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
    .select("id, name, branch_name, status")
    .eq("business_id", businessId)
    .order("name");
  return (data ?? []) as {
    id: string;
    name: string;
    branch_name: string | null;
    status: ListingStatus;
  }[];
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
    .select("id, action, from_status, to_status, created_at")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as import("@/lib/control-room-shared").AuditEvent[];
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
  const paidMap =
    revenueCatIsConfigured() && ids.length
      ? await getPaidMembershipMap(ids)
      : new Map<string, boolean>();

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
  revenueCatReady: boolean;
  serviceRoleReady: boolean;
  loadError: string | null;
}> {
  const admin = createServiceClient();
  const supabase = await createClient();
  const revenueCatReady = revenueCatIsConfigured();
  const serviceRoleReady = Boolean(admin);

  if (!supabase) {
    return { members: [], revenueCatReady, serviceRoleReady, loadError: "Supabase is not connected." };
  }

  if (!admin) {
    const members = await loadMembersFromProfiles(supabase, query);
    return {
      members,
      revenueCatReady,
      serviceRoleReady,
      loadError: "SUPABASE_SERVICE_ROLE_KEY is missing from the running server.",
    };
  }

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error || !data?.users) {
    const members = await loadMembersFromProfiles(supabase, query);
    return {
      members,
      revenueCatReady,
      serviceRoleReady,
      loadError: error?.message ?? "Could not list auth users.",
    };
  }

  const users = data.users;
  const ids = users.map((user) => user.id);
  const legacyIds = users
    .map((user) => {
      const legacy = user.app_metadata?.legacy_wp_user_id;
      return legacy === null || legacy === undefined ? "" : String(legacy);
    })
    .filter(Boolean);
  const paidLookupIds = [...new Set([...ids, ...legacyIds])];
  const [{ data: profiles }, paidMap] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, onboarding_step, created_at")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    revenueCatReady
      ? getPaidMembershipMap(paidLookupIds)
      : Promise.resolve(new Map<string, boolean>()),
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
    const legacyId = user.app_metadata?.legacy_wp_user_id;
    const legacyKey = legacyId === null || legacyId === undefined ? "" : String(legacyId);
    const paid = Boolean(paidMap.get(user.id) || (legacyKey && paidMap.get(legacyKey)));
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
    revenueCatReady,
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
  const media = [...(listing.listing_media ?? [])].sort((a, b) => {
    if (a.is_cover !== b.is_cover) return a.is_cover ? -1 : 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  return media.find((item) => item.public_url)?.public_url ?? null;
}
