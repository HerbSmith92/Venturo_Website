import { memberPriceCentsFromDiscount, type MemberDiscountKind } from "@/lib/event-types";
import {
  ageFrom,
  compareAttention,
  formatCount,
  formatWhen,
  formatZar,
  hostOwedCents,
  inRange,
  johannesburgDateKey,
  percentDelta,
  platformLabel,
  previousRange,
  resolveRange,
  uniqueIds,
  venturoFeeCents,
  type AttentionSeverity,
  type PlatformFilter,
  type ReportRange,
  isPlatformFilter,
} from "@/lib/overview/metrics";
import { USAGE_KINDS } from "@/lib/member-usage";
import { areaCoverageSummary, loadAreaCoverage } from "@/lib/area-coverage";
import { interestCoverageSummary, loadInterestCoverage } from "@/lib/interest-coverage";
import { loadPopularSearches, loadSearchMisses, searchMissSummary, searchPopularSummary } from "@/lib/search-misses";
import { loadPopularSaves, popularSavesSummary } from "@/lib/popular-saves";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type HeadlineCard = {
  label: string;
  display: string;
  scope: string;
  comparison: string;
  href?: string;
  hint?: string;
};

export type AttentionItem = {
  id: string;
  kind: string;
  type: string;
  item: string;
  severity: AttentionSeverity;
  age: string;
  ageHours: number;
  href: string;
  owner: string | null;
};

export type UpcomingRow = {
  id: string;
  href: string;
  title: string;
  when: string;
  host: string;
  status: string;
  paid: string;
  rsvps: string;
  capacity: string;
  sales: string;
  readiness: string;
  checkIns: string;
  warn: boolean;
};

export type ContentCard = {
  title: string;
  href: string;
  summary: { label: string; display: string; href?: string }[];
  attention: { label: string; display: string; href?: string }[];
  performance: { label: string; display: string }[];
  archived: { label: string; display: string; href: string } | null;
  note?: string;
};

export type MoneyLine = {
  label: string;
  display: string;
  hint: string;
  href?: string;
};

export type Insight = {
  title: string;
  body: string;
  href?: string;
};

export type HealthRow = {
  name: string;
  label: string;
  tone: "healthy" | "failing" | "unknown";
  checked: string;
};

export type OverviewSettings = {
  overdueHours: number;
  lowSalesPercent: number;
  lowSalesWithinDays: number;
  membershipEndingDays: number;
  payoutDueDays: number;
  listingCheckDays: number;
  ticketEmailGraceMinutes: number;
  activityStartedAt: string | null;
};

export type OverviewModel = {
  ready: boolean;
  banner: string | null;
  range: ReportRange;
  previousLabel: string;
  platform: PlatformFilter;
  platformName: string;
  loadedAt: string;
  from: string;
  to: string;
  settings: OverviewSettings;
  canEditThresholds: boolean;
  attention: AttentionItem[];
  attentionTotal: number;
  headlines: HeadlineCard[];
  upcoming: UpcomingRow[];
  upcomingState: "ready" | "unavailable" | "empty";
  content: ContentCard[];
  money: MoneyLine[];
  moneyNote: string;
  insights: Insight[];
  health: HealthRow[];
  definitions: { title: string; body: string }[];
};

type OrderRow = {
  id: string;
  status: string;
  subtotal_cents: number | null;
  commission_cents: number | null;
  booking_fee_cents: number | null;
  total_cents: number | null;
  paid_at: string | null;
  refunded_at: string | null;
  payout_status: string | null;
  buyer_id: string | null;
  event_id: string | null;
  ticket_email_sent_at: string | null;
  used_member_pricing: boolean | null;
  created_at: string;
  events?: { title?: string; status?: string; ends_at?: string | null; organiser_id?: string } | { title?: string; status?: string; ends_at?: string | null; organiser_id?: string }[] | null;
};

type ItemRow = {
  order_id: string;
  quantity: number;
  unit_price_cents: number | null;
  event_ticket_types?:
    | {
        kind?: string;
        price_cents?: number;
        member_discount_kind?: string;
        member_discount_value?: number | null;
      }
    | {
        kind?: string;
        price_cents?: number;
        member_discount_kind?: string;
        member_discount_value?: number | null;
      }[]
    | null;
};

const DEFAULT_SETTINGS: OverviewSettings = {
  overdueHours: 48,
  lowSalesPercent: 25,
  lowSalesWithinDays: 3,
  membershipEndingDays: 7,
  payoutDueDays: 7,
  listingCheckDays: 180,
  ticketEmailGraceMinutes: 30,
  activityStartedAt: null,
};

const UNAVAILABLE = "Data unavailable";

function embed<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function missingRelation(error: { message?: string } | null) {
  const message = error?.message ?? "";
  return /does not exist|schema cache|Could not find the/i.test(message);
}

async function headCount(
  run: PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<number | null> {
  const { count, error } = await run;
  if (error) return null;
  return count ?? 0;
}

function figure(label: string, value: number | null, href?: string) {
  return {
    label,
    display: value === null ? UNAVAILABLE : formatCount(value),
    href: value === null ? undefined : href,
  };
}

function moneyFigure(cents: number | null) {
  return cents === null ? UNAVAILABLE : formatZar(cents);
}

export async function loadControlRoomOverview(
  input: { range?: string; from?: string; to?: string; platform?: string; kind?: string },
  options?: { now?: Date; admin?: boolean },
): Promise<OverviewModel> {
  const now = options?.now ?? new Date();
  const range = resolveRange(input, now);
  const previous = previousRange(range);
  const platform: PlatformFilter = isPlatformFilter(input.platform) ? input.platform : "all";
  const loadedAt = now.toISOString();
  const base = {
    range,
    previousLabel: "previous period",
    platform,
    platformName: platformLabel(platform),
    loadedAt,
    from: johannesburgDateKey(range.start),
    to: johannesburgDateKey(range.end),
    settings: DEFAULT_SETTINGS,
    canEditThresholds: Boolean(options?.admin),
    kind: input.kind ?? "",
  };

  const service = createServiceClient();
  const userClient = await createClient();
  const db = service ?? userClient;
  if (!db) {
    return emptyModel(base, "Supabase is not connected.");
  }

  const settings = await loadSettings(db);
  const excluded = service ? await loadExcluded(service) : { ok: false, ids: new Set<string>() };
  const attention: AttentionItem[] = [];

  const content = await loadContent(db, service, range, settings, now, attention);
  const commerce = await loadCommerce({
    db,
    service,
    range,
    previous,
    platform,
    excluded,
    settings,
    now,
    attention,
  });

  attention.sort(compareAttention);
  const kind = (input.kind ?? "").trim();
  const visible = kind ? attention.filter((item) => item.kind === kind) : attention;

  await writeSnapshots(service, now, commerce, content);

  return {
    ready: true,
    banner: service
      ? excluded.ok
        ? null
        : "Test accounts could not be listed, so user and money totals are withheld."
      : "The service role key is missing, so accounts, memberships, and some activity totals are withheld.",
    range,
    previousLabel: previousLabel(range),
    platform,
    platformName: platformLabel(platform),
    loadedAt,
    from: base.from,
    to: base.to,
    settings,
    canEditThresholds: Boolean(options?.admin),
    attention: visible,
    attentionTotal: attention.length,
    headlines: commerce.headlines,
    upcoming: commerce.upcoming,
    upcomingState: commerce.upcomingState,
    content: content.cards,
    money: commerce.money,
    moneyNote: commerce.moneyNote,
    insights: commerce.insights,
    health: commerce.health,
    definitions: DEFINITIONS,
  };
}

function previousLabel(range: ReportRange) {
  if (range.key === "today") return "yesterday";
  if (range.key === "30d") return "the previous 30 days";
  if (range.key === "custom") return "the previous period";
  return "the previous 7 days";
}

function emptyModel(
  base: {
    range: ReportRange;
    platform: PlatformFilter;
    platformName: string;
    loadedAt: string;
    from: string;
    to: string;
    settings: OverviewSettings;
    canEditThresholds: boolean;
  },
  banner: string,
): OverviewModel {
  const blocked = "Data unavailable";
  return {
    ready: false,
    banner,
    ...base,
    previousLabel: previousLabel(base.range),
    attention: [],
    attentionTotal: 0,
    headlines: HEADLINE_LABELS.map((label) => ({
      label,
      display: blocked,
      scope: "Data unavailable",
      comparison: blocked,
    })),
    upcoming: [],
    upcomingState: "unavailable",
    content: [],
    money: [],
    moneyNote: blocked,
    insights: [],
    health: HEALTH_NAMES.map((name) => ({
      name,
      label: "Unknown",
      tone: "unknown" as const,
      checked: "Not monitored",
    })),
    definitions: DEFINITIONS,
  };
}

const HEADLINE_LABELS = [
  "Active users",
  "New accounts",
  "Paid members",
  "Paid tickets sold",
  "Venturo revenue",
  "Upcoming events",
];

const HEALTH_NAMES = [
  "Website",
  "iOS",
  "Android",
  "Backend / API",
  "Payments",
  "Ticket issuance",
  "Ticket email",
  "Wallet access",
  "Membership access",
];

async function loadSettings(db: SupabaseClient): Promise<OverviewSettings> {
  const { data, error } = await db.from("ops_dashboard_settings").select("*").eq("id", 1).maybeSingle();
  if (error || !data) return DEFAULT_SETTINGS;
  return {
    overdueHours: numberOr(data.overdue_hours, DEFAULT_SETTINGS.overdueHours),
    lowSalesPercent: numberOr(data.low_sales_percent, DEFAULT_SETTINGS.lowSalesPercent),
    lowSalesWithinDays: numberOr(data.low_sales_within_days, DEFAULT_SETTINGS.lowSalesWithinDays),
    membershipEndingDays: numberOr(data.membership_ending_days, DEFAULT_SETTINGS.membershipEndingDays),
    payoutDueDays: numberOr(data.payout_due_days, DEFAULT_SETTINGS.payoutDueDays),
    listingCheckDays: numberOr(data.listing_check_days, DEFAULT_SETTINGS.listingCheckDays),
    ticketEmailGraceMinutes: numberOr(data.ticket_email_grace_minutes, DEFAULT_SETTINGS.ticketEmailGraceMinutes),
    activityStartedAt: typeof data.activity_started_at === "string" ? data.activity_started_at : null,
  };
}

function numberOr(value: unknown, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

async function loadExcluded(service: SupabaseClient) {
  const { data, error } = await service.rpc("metrics_excluded_user_ids");
  if (error || !Array.isArray(data)) return { ok: false, ids: new Set<string>() };
  return { ok: true, ids: new Set(data.filter((id): id is string => typeof id === "string")) };
}

function notExcluded<T extends { buyer_id?: string | null; user_id?: string | null; id?: string }>(
  rows: T[],
  ids: Set<string>,
  key: "buyer_id" | "user_id" | "id",
) {
  return rows.filter((row) => {
    const id = row[key];
    return !id || !ids.has(id);
  });
}

async function loadContent(
  db: SupabaseClient,
  service: SupabaseClient | null,
  range: ReportRange,
  settings: OverviewSettings,
  now: Date,
  attention: AttentionItem[],
) {
  const [
    live,
    review,
    changes,
    drafts,
    archivedListings,
    incomplete,
    revisions,
    eventsReview,
    eventChanges,
    eventDrafts,
    eventArchived,
    communitiesLive,
    communitiesRequested,
    communityDrafts,
    communityArchived,
    guidesPublished,
    guideDrafts,
    guideArchived,
  ] = await Promise.all([
    headCount(db.from("directory_listings").select("id", { count: "exact", head: true }).eq("status", "approved").eq("is_suspended", false)),
    headCount(db.from("directory_listings").select("id", { count: "exact", head: true }).eq("status", "review")),
    headCount(
      db
        .from("directory_listings")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft")
        .not("review_note", "is", null)
        .neq("review_note", ""),
    ),
    headCount(
      db
        .from("directory_listings")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft")
        .or("review_note.is.null,review_note.eq."),
    ),
    headCount(db.from("directory_listings").select("id", { count: "exact", head: true }).eq("status", "archived")),
    headCount(
      db
        .from("directory_listings")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved")
        .eq("is_suspended", false)
        .or("city.is.null,city.eq.,short_description.is.null,short_description.eq."),
    ),
    db.from("listing_revisions").select("listing_id, updated_at").eq("state", "review"),
    headCount(db.from("events").select("id", { count: "exact", head: true }).eq("status", "review")),
    headCount(
      db
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft")
        .not("review_note", "is", null)
        .neq("review_note", ""),
    ),
    headCount(
      db.from("events").select("id", { count: "exact", head: true }).eq("status", "draft").or("review_note.is.null,review_note.eq."),
    ),
    headCount(db.from("events").select("id", { count: "exact", head: true }).eq("status", "archived")),
    headCount(db.from("communities").select("id", { count: "exact", head: true }).eq("status", "published")),
    headCount(db.from("communities").select("id", { count: "exact", head: true }).eq("status", "requested")),
    headCount(db.from("communities").select("id", { count: "exact", head: true }).eq("status", "draft")),
    headCount(db.from("communities").select("id", { count: "exact", head: true }).eq("status", "archived")),
    headCount(db.from("curated_guides").select("id", { count: "exact", head: true }).eq("status", "published")),
    headCount(db.from("curated_guides").select("id", { count: "exact", head: true }).eq("status", "draft")),
    headCount(db.from("curated_guides").select("id", { count: "exact", head: true }).eq("status", "archived")),
  ]);

  const revisionRows = revisions.error ? null : revisions.data ?? [];
  pushGroup(attention, {
    id: "directory-review",
    kind: "directory",
    type: "Directory approval",
    count: review,
    noun: "new listing",
    href: "/admin/listings?status=review",
    severity: "medium",
    now,
  });
  pushGroup(attention, {
    id: "directory-changes",
    kind: "directory",
    type: "Changes requested",
    count: changes,
    noun: "directory change request",
    href: "/admin/listings?status=changes",
    severity: "medium",
    now,
  });
  pushGroup(attention, {
    id: "directory-revisions",
    kind: "directory",
    type: "Live edit awaiting review",
    count: revisionRows ? revisionRows.length : null,
    noun: "live listing edit",
    href: "/admin/listings?status=approved",
    severity: "medium",
    now,
    oldest: oldestIso(revisionRows, "updated_at"),
  });
  pushGroup(attention, {
    id: "events-review",
    kind: "events",
    type: "Event approval",
    count: eventsReview,
    noun: "event",
    href: "/admin/events?status=review",
    severity: "high",
    now,
  });
  pushGroup(attention, {
    id: "events-changes",
    kind: "events",
    type: "Event changes requested",
    count: eventChanges,
    noun: "event change request",
    href: "/admin/events?status=changes",
    severity: "medium",
    now,
  });
  pushGroup(attention, {
    id: "communities-requested",
    kind: "communities",
    type: "Community application",
    count: communitiesRequested,
    noun: "community application",
    href: "/admin/communities?status=requested",
    severity: "medium",
    now,
  });

  const checks = await listingChecks(db, settings, now);
  pushGroup(attention, {
    id: "directory-stale",
    kind: "directory",
    type: "Listing check due",
    count: checks,
    noun: "listing due for a check",
    href: "/admin/listings?status=approved",
    severity: "low",
    now,
  });

  const partners = await discountPartners(db);
  const saves = service ? await savesInRange(service, range) : null;
  const guideHealth = await guideHealthCounts(db, settings, now);
  const communityStats = await communityActivity(db, range, now);

  const cards: ContentCard[] = [
    {
      title: "Directory",
      href: "/admin/listings?status=approved",
      summary: [
        figure("Live listings", live, "/admin/listings?status=approved"),
        figure("New submissions", review, "/admin/listings?status=review"),
        figure("Discount partners", partners, "/admin/listings?status=approved"),
      ],
      attention: [
        figure("Pending approvals", review, "/admin/listings?status=review"),
        figure("Changes requested", changes, "/admin/listings?status=changes"),
        figure("Ordinary drafts", drafts, "/admin/listings?status=draft"),
        figure("Incomplete listings", incomplete, "/admin/listings?status=approved"),
        figure("Due for a check", checks, "/admin/listings?status=approved"),
      ],
      performance: [
        { label: "Saves", display: saves ? formatCount(saves.listing) : UNAVAILABLE },
        { label: "Views", display: UNAVAILABLE },
        { label: "Directions", display: UNAVAILABLE },
        { label: "Contact clicks", display: UNAVAILABLE },
      ],
      archived: archivedListings === null ? null : { label: "Archived", display: formatCount(archivedListings), href: "/admin/listings?status=archived" },
      note: "Changes requested are drafts with a staff review note. Ordinary drafts are separate. Views, directions, and contact clicks are not tracked.",
    },
    {
      title: "Events",
      href: "/admin/events?status=approved",
      summary: [
        { label: "In review", display: eventsReview === null ? UNAVAILABLE : formatCount(eventsReview), href: "/admin/events?status=review" },
        { label: "Drafts", display: eventDrafts === null ? UNAVAILABLE : formatCount(eventDrafts), href: "/admin/events?status=draft" },
        { label: "Changes requested", display: eventChanges === null ? UNAVAILABLE : formatCount(eventChanges), href: "/admin/events?status=changes" },
      ],
      attention: [
        figure("Pending reviews", eventsReview, "/admin/events?status=review"),
        figure("Changes requested", eventChanges, "/admin/events?status=changes"),
      ],
      performance: [
        { label: "Website views", display: "See growth" },
        { label: "Booking conversion", display: "See growth" },
        { label: "Check-ins", display: "On the event day" },
      ],
      archived: eventArchived === null ? null : { label: "Archived", display: formatCount(eventArchived), href: "/admin/events?status=archived" },
      note: "Ticket sales and readiness are on the upcoming list and in Payments. A change request is a draft with a review note.",
    },
    {
      title: "Communities",
      href: "/admin/communities",
      summary: [
        figure("Live communities", communitiesLive, "/admin/communities"),
        { label: "Members", display: communityStats.members === null ? UNAVAILABLE : formatCount(communityStats.members) },
        { label: "With upcoming events", display: communityStats.withEvents === null ? UNAVAILABLE : formatCount(communityStats.withEvents) },
      ],
      attention: [
        figure("Pending applications", communitiesRequested, "/admin/communities?status=requested"),
        figure("Drafts", communityDrafts, "/admin/communities?status=draft"),
        { label: "Reports", display: UNAVAILABLE },
      ],
      performance: [
        { label: "New joins", display: communityStats.joins === null ? UNAVAILABLE : formatCount(communityStats.joins) },
        {
          label: "Active communities",
          display: communityStats.active === null ? UNAVAILABLE : formatCount(communityStats.active),
        },
      ],
      archived:
        communityArchived === null
          ? null
          : { label: "Archived", display: formatCount(communityArchived), href: "/admin/communities?status=archived" },
      note: "Active means a new member, a claimed organiser update, or a linked event in this period. Member count alone is not activity. Reports are not stored. Drafts are not a separate change-request workflow.",
    },
    {
      title: "Guides",
      href: "/admin/guides?status=published",
      summary: [
        figure("Published", guidesPublished, "/admin/guides?status=published"),
        figure("Drafts", guideDrafts, "/admin/guides?status=draft"),
        { label: "Pending reviews", display: UNAVAILABLE },
      ],
      attention: [
        { label: "Outdated", display: guideHealth.outdated === null ? UNAVAILABLE : formatCount(guideHealth.outdated), href: "/admin/guides?status=published" },
        { label: "Unavailable references", display: guideHealth.broken === null ? UNAVAILABLE : formatCount(guideHealth.broken), href: "/admin/guides?status=published" },
      ],
      performance: [
        { label: "Saves", display: saves ? formatCount(saves.guide) : UNAVAILABLE },
        { label: "Readers", display: UNAVAILABLE },
        { label: "Clicks to listings or events", display: UNAVAILABLE },
      ],
      archived: guideArchived === null ? null : { label: "Archived", display: formatCount(guideArchived), href: "/admin/guides?status=archived" },
      note: "Guides have draft, published, and archived. There is no review status, reader count, or click tracking.",
    },
  ];

  return { cards, liveListings: live, liveCommunities: communitiesLive, publishedGuides: guidesPublished };
}

function oldestIso(rows: { updated_at?: string }[] | null, key: "updated_at") {
  if (!rows?.length) return null;
  return rows.reduce<string | null>((oldest, row) => {
    const value = row[key];
    if (!value) return oldest;
    if (!oldest || value < oldest) return value;
    return oldest;
  }, null);
}

function pushGroup(
  attention: AttentionItem[],
  input: {
    id: string;
    kind: string;
    type: string;
    count: number | null;
    noun: string;
    href: string;
    severity: AttentionSeverity;
    now: Date;
    oldest?: string | null;
  },
) {
  if (input.count === null || input.count <= 0) return;
  const age = ageFrom(input.oldest, input.now);
  attention.push({
    id: input.id,
    kind: input.kind,
    type: input.type,
    item: `${formatCount(input.count)} ${input.noun}${input.count === 1 ? "" : "s"}`,
    severity: input.severity,
    age: input.oldest ? age.label : "Queue",
    ageHours: input.oldest ? age.hours : input.severity === "high" ? 10_000 : 0,
    href: input.href,
    owner: null,
  });
}

async function listingChecks(db: SupabaseClient, settings: OverviewSettings, now: Date) {
  const cutoff = new Date(now.getTime() - settings.listingCheckDays * 86_400_000).toISOString();
  const [stale, never] = await Promise.all([
    headCount(
      db
        .from("directory_listings")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved")
        .eq("is_suspended", false)
        .lt("last_verified_at", cutoff),
    ),
    headCount(
      db
        .from("directory_listings")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved")
        .eq("is_suspended", false)
        .is("last_verified_at", null)
        .lt("published_at", cutoff),
    ),
  ]);
  if (stale === null || never === null) return null;
  return stale + never;
}

async function discountPartners(db: SupabaseClient) {
  const { data, error } = await db
    .from("price_options")
    .select("member_price, listing_activities!inner(listing_id, directory_listings!inner(status, is_suspended))")
    .gt("member_price", 0)
    .limit(5000);
  if (error) return null;
  const ids = new Set<string>();
  for (const row of data ?? []) {
    const activity = embed(
      row.listing_activities as
        | { listing_id?: string; directory_listings?: { status?: string; is_suspended?: boolean } | { status?: string; is_suspended?: boolean }[] }
        | { listing_id?: string; directory_listings?: { status?: string; is_suspended?: boolean } | { status?: string; is_suspended?: boolean }[] }[],
    );
    const listing = embed(activity?.directory_listings);
    if (activity?.listing_id && listing?.status === "approved" && !listing.is_suspended) ids.add(activity.listing_id);
  }
  return ids.size;
}

async function savesInRange(service: SupabaseClient, range: ReportRange) {
  const { data, error } = await service
    .from("member_saves")
    .select("kind")
    .gte("created_at", range.start.toISOString())
    .lte("created_at", range.end.toISOString())
    .limit(5000);
  if (error) return null;
  const tally = { listing: 0, event: 0, guide: 0 };
  for (const row of data ?? []) {
    if (row.kind === "listing") tally.listing += 1;
    if (row.kind === "event") tally.event += 1;
    if (row.kind === "guide") tally.guide += 1;
  }
  return tally;
}

async function guideHealthCounts(db: SupabaseClient, settings: OverviewSettings, now: Date) {
  const cutoff = new Date(now.getTime() - settings.listingCheckDays * 86_400_000).toISOString();
  const [expired, stale, broken] = await Promise.all([
    headCount(
      db.from("curated_guides").select("id", { count: "exact", head: true }).eq("status", "published").lt("expire_at", now.toISOString()),
    ),
    headCount(
      db.from("curated_guides").select("id", { count: "exact", head: true }).eq("status", "published").lt("updated_at", cutoff),
    ),
    brokenGuideReferences(db),
  ]);
  if (expired === null || stale === null) return { outdated: null, broken };
  return { outdated: expired + stale, broken };
}

async function brokenGuideReferences(db: SupabaseClient) {
  const { data, error } = await db
    .from("curated_guide_items")
    .select("id, curated_guides!inner(status), directory_listings!inner(status)")
    .eq("curated_guides.status", "published")
    .limit(5000);
  if (error) return null;
  return (data ?? []).filter((row) => {
    const listing = embed(row.directory_listings as { status?: string } | { status?: string }[]);
    return listing?.status !== "approved";
  }).length;
}

async function communityActivity(db: SupabaseClient, range: ReportRange, now: Date) {
  const soon = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const [members, follows, communities, links] = await Promise.all([
    headCount(db.from("community_follows").select("user_id", { count: "exact", head: true })),
    db
      .from("community_follows")
      .select("community_id, created_at")
      .gte("created_at", range.start.toISOString())
      .lte("created_at", range.end.toISOString())
      .limit(5000),
    db.from("communities").select("id, updated_at, claimed_by, status").eq("status", "published").limit(2000),
    db.from("community_events").select("community_id, event_id, events!inner(status, starts_at)").limit(5000),
  ]);

  const joins = follows.error ? null : (follows.data ?? []).length;
  const joinIds = new Set((follows.data ?? []).map((row) => row.community_id as string));
  const active = new Set<string>(joinIds);
  if (!communities.error) {
    for (const row of communities.data ?? []) {
      if (row.claimed_by && row.updated_at && inRange(row.updated_at, range.start, range.end)) {
        active.add(row.id as string);
      }
    }
  }
  let withEvents: number | null = null;
  if (!links.error) {
    const upcoming = new Set<string>();
    for (const row of links.data ?? []) {
      const event = embed(row.events as { status?: string; starts_at?: string } | { status?: string; starts_at?: string }[]);
      if (event?.status === "approved" && event.starts_at && event.starts_at >= now.toISOString() && event.starts_at <= soon) {
        upcoming.add(row.community_id as string);
        active.add(row.community_id as string);
      }
      if (event?.status === "approved" && inRange(event.starts_at, range.start, range.end)) {
        active.add(row.community_id as string);
      }
    }
    withEvents = upcoming.size;
  }
  return {
    members,
    joins,
    withEvents: links.error ? null : withEvents,
    active: communities.error && follows.error ? null : active.size,
  };
}

type CommerceInput = {
  db: SupabaseClient;
  service: SupabaseClient | null;
  range: ReportRange;
  previous: { start: Date; end: Date };
  platform: PlatformFilter;
  excluded: { ok: boolean; ids: Set<string> };
  settings: OverviewSettings;
  now: Date;
  attention: AttentionItem[];
};

async function loadCommerce(input: CommerceInput) {
  const { db, service, range, previous, platform, excluded, settings, now, attention } = input;
  const moneyOk = Boolean(service) && excluded.ok;
  const orders = moneyOk && service ? await loadOrders(service, previous.start) : null;
  const owed = moneyOk && service ? await loadOwed(service) : null;
  const items = orders ? await loadItems(service!, orders.rows.map((row) => row.id)) : null;
  const activity = service && excluded.ok ? await loadActivity(service, previous.start, range.end, platform, settings) : null;
  const accounts = service && excluded.ok ? await loadAccounts(service, previous.start, excluded.ids) : null;
  const members = service && excluded.ok ? await loadMembers(service, excluded.ids, platform) : null;
  const subscriptions = service && excluded.ok ? await loadSubscriptionCents(service, previous.start, excluded.ids) : null;

  const cleanOrders = orders ? notExcluded(orders.rows, excluded.ids, "buyer_id") : [];
  const itemByOrder = groupItems(items);
  const issued = orders && items && service ? await loadIssued(service, cleanOrders) : null;

  const ticketNow = sumTickets(cleanOrders, itemByOrder, range.start, range.end);
  const ticketPrev = sumTickets(cleanOrders, itemByOrder, previous.start, previous.end);
  const fulfillment = issued ? assessFulfillment(cleanOrders, itemByOrder, issued, settings, now, attention) : null;
  const feesNow = orders ? sumFees(cleanOrders, range.start, range.end) : null;
  const feesPrev = orders ? sumFees(cleanOrders, previous.start, previous.end) : null;
  const subsNow = subscriptions ? sumSubs(subscriptions, range.start, range.end) : null;
  const subsPrev = subscriptions ? sumSubs(subscriptions, previous.start, previous.end) : null;

  const revenueNow = feesNow !== null && subsNow !== null ? feesNow + subsNow : null;
  const revenuePrev = feesPrev !== null && subsPrev !== null ? feesPrev + subsPrev : null;

  const upcoming = await loadUpcoming(db, service, settings, now, excluded.ids, attention);

  if (orders && items) pushDiscountIssues(attention, cleanOrders, itemByOrder, range, now);
  if (owed) pushPayouts(attention, owed, settings, now, excluded.ids);
  const membershipGaps =
    service && excluded.ok ? await pushMembershipIssues(service, excluded.ids, settings, now, attention, platform) : null;
  await pushEnquiries(db, settings, now, attention);

  const periodName = range.label;
  const compare = (current: number | null, prior: number | null, allow: boolean) => {
    if (!allow) return "Whole platform";
    if (current === null || prior === null) return UNAVAILABLE;
    return percentDelta(current, prior);
  };

  const activityCard = activityCardFor(activity, platform, range, previous, excluded.ids);
  const accountCard = accountCardFor(accounts, platform, range, previous);
  const memberComparison = await paidMemberComparison(service, members, platform, previous.end);
  const memberCard = memberCardFor(members, platform, memberComparison);
  const upcomingCount = upcoming.state === "ready" ? upcoming.rows.length : null;

  const headlines: HeadlineCard[] = [
    activityCard,
    accountCard,
    memberCard,
    {
      label: "Paid tickets sold",
      display: moneyOk && items ? formatCount(ticketNow.paid) : UNAVAILABLE,
      scope: moneyOk ? periodName : "Needs the service role and test-account list",
      comparison: compare(moneyOk && items ? ticketNow.paid : null, ticketPrev.paid, platform === "all"),
      href: platform === "all" ? operationsHref("paid", range) : undefined,
      hint:
        platform !== "all"
          ? "Ticket orders are not attributed to a platform."
          : moneyOk && items
            ? orders?.refundsKnown
              ? `${formatCount(ticketNow.refunded)} refunded in this period · ${formatCount(ticketNow.free)} free RSVPs · ${formatCount(ticketNow.cancelled)} on cancelled events. A later refund stays in the original sale and is also listed on the refund date.`
              : `${formatCount(ticketNow.free)} free RSVPs · ${formatCount(ticketNow.cancelled)} on cancelled events. Refund dates are unavailable until the ops migration is applied.`
            : "Paid, refunded, and free tickets could not be separated.",
    },
    {
      label: "Venturo revenue",
      display: platform === "all" ? moneyFigure(revenueNow) : UNAVAILABLE,
      scope: platform === "all" ? `${periodName} · fees & website subscriptions` : "Not attributed by platform",
      comparison: compare(platform === "all" ? revenueNow : null, revenuePrev, platform === "all"),
      href: platform === "all" ? operationsHref("paid", range) : undefined,
      hint: "Ticketing fees plus website subscriptions. Store proceeds and Paystack gateway fees are not in this figure. Ticket sales are a separate total.",
    },
    {
      label: "Upcoming events",
      display: upcomingCount === null ? UNAVAILABLE : formatCount(upcomingCount),
      scope: "Next 7 days · published",
      comparison: "Current schedule",
      href: "/admin/events?status=approved",
      hint: "Not filtered by the reporting period or platform. Cancelled events are excluded.",
    },
  ];

  const refundCents = orders?.refundsKnown ? sumRefunds(cleanOrders, range.start, range.end) : null;
  const grossCents = orders ? sumGross(cleanOrders, range.start, range.end) : null;
  const payout = summarisePayouts(owed, excluded.ids, settings, now);

  const money: MoneyLine[] = platform !== "all"
    ? [
        {
          label: "Platform filter",
          display: UNAVAILABLE,
          hint: "Orders, fees, and payouts are not stored against Website, iOS, or Android.",
        },
      ]
    : [
        {
          label: "Gross ticket sales",
          display: grossCents === null ? UNAVAILABLE : moneyFigure(grossCents),
          hint: "Subtotal of successful payments in this period, including sales later refunded. This is not Venturo revenue.",
          href: operationsHref("paid", range),
        },
        {
          label: "Venturo ticketing fees",
          display: feesNow === null ? UNAVAILABLE : moneyFigure(feesNow),
          hint: "commission_cents + booking_fee_cents on those payments. Gateway fees are not deducted.",
          href: operationsHref("paid", range),
        },
        {
          label: "Subscription revenue",
          display: moneyOk ? moneyFigure(subsNow) : UNAVAILABLE,
          hint: "Website membership charges in this period. App Store and Play proceeds are not in the ledger.",
          href: "/admin/members?plan=paid&metrics=1",
        },
        {
          label: "Refunds",
          display: refundCents === null ? UNAVAILABLE : moneyFigure(refundCents),
          hint: orders?.refundsKnown
            ? "Subtotal of orders refunded in this period, dated by refunded_at. Payment disputes are not tracked."
            : "Refund dates are unavailable until the ops migration is applied. Payment disputes are not tracked.",
          href: operationsHref("refunded", range),
        },
        {
          label: "Owed to hosts",
          display: moneyOk && payout ? moneyFigure(payout.owed) : UNAVAILABLE,
          hint: "Paid orders still marked owed. Host amount is the subtotal, minus fees that were not passed on to the buyer.",
          href: "/admin/operations?status=owed",
        },
        {
          label: "Overdue payouts",
          display: moneyOk && payout ? moneyFigure(payout.overdue) : UNAVAILABLE,
          hint: payout
            ? `${formatCount(payout.overdueCount)} payouts past ${settings.payoutDueDays} days after the event. Next due ${payout.nextDue ?? "—"}.`
            : UNAVAILABLE,
          href: "/admin/operations?status=owed",
        },
      ];

  const insights = await loadInsights({
    service,
    range,
    platform,
    excludedOk: excluded.ok,
    excluded: excluded.ids,
  });

  const health = healthRows({
    now,
    ticketGaps: fulfillment ? fulfillment.ticketGaps : null,
    emailGaps: fulfillment ? fulfillment.emailGaps : null,
    membershipGaps,
  });

  return {
    headlines,
    upcoming: upcoming.rows,
    upcomingState: upcoming.state,
    money,
    moneyNote:
      "Refunds leave the original paid_at in place and set refunded_at, so the sale and the refund stay in their own periods. Snapshots of stock figures are kept in ops_metric_days.",
    insights,
    health,
    paidMembers: members?.current ?? null,
    upcomingEvents: upcomingCount,
  };
}

function operationsHref(status: string, range: ReportRange) {
  const params = new URLSearchParams({
    status,
    from: johannesburgDateKey(range.start),
    to: johannesburgDateKey(range.end),
  });
  return `/admin/operations?${params.toString()}`;
}

const ORDER_COLUMNS =
  "id, status, subtotal_cents, commission_cents, booking_fee_cents, total_cents, paid_at, refunded_at, payout_status, buyer_id, event_id, ticket_email_sent_at, used_member_pricing, created_at, events(title, status, ends_at, organiser_id)";
const ORDER_COLUMNS_LEGACY = ORDER_COLUMNS.replace("refunded_at, ", "");

async function loadOrders(service: SupabaseClient, since: Date) {
  const first = await service
    .from("event_orders")
    .select(ORDER_COLUMNS)
    .or(`paid_at.gte.${since.toISOString()},refunded_at.gte.${since.toISOString()}`)
    .limit(5000);
  if (!first.error) return { rows: (first.data ?? []) as unknown as OrderRow[], refundsKnown: true };
  if (!/refunded_at/i.test(first.error.message)) return null;
  const second = await service
    .from("event_orders")
    .select(ORDER_COLUMNS_LEGACY)
    .gte("paid_at", since.toISOString())
    .limit(5000);
  if (second.error) return null;
  return {
    rows: ((second.data ?? []) as unknown as OrderRow[]).map((row) => ({ ...row, refunded_at: null })),
    refundsKnown: false,
  };
}

async function loadOwed(service: SupabaseClient) {
  const first = await service
    .from("event_orders")
    .select(ORDER_COLUMNS)
    .eq("status", "paid")
    .eq("payout_status", "owed")
    .limit(2000);
  if (!first.error) return (first.data ?? []) as unknown as OrderRow[];
  if (!/refunded_at/i.test(first.error.message)) return null;
  const second = await service
    .from("event_orders")
    .select(ORDER_COLUMNS_LEGACY)
    .eq("status", "paid")
    .eq("payout_status", "owed")
    .limit(2000);
  if (second.error) return null;
  return ((second.data ?? []) as unknown as OrderRow[]).map((row) => ({ ...row, refunded_at: null }));
}

async function loadItems(service: SupabaseClient, orderIds: string[]) {
  const rows: ItemRow[] = [];
  for (let index = 0; index < orderIds.length; index += 150) {
    const slice = orderIds.slice(index, index + 150);
    if (!slice.length) continue;
    const { data, error } = await service
      .from("event_order_items")
      .select(
        "order_id, quantity, unit_price_cents, event_ticket_types(kind, price_cents, member_discount_kind, member_discount_value)",
      )
      .in("order_id", slice);
    if (error) return null;
    rows.push(...((data ?? []) as ItemRow[]));
  }
  return rows;
}

function groupItems(items: ItemRow[] | null) {
  const map = new Map<string, ItemRow[]>();
  for (const item of items ?? []) {
    const list = map.get(item.order_id) ?? [];
    list.push(item);
    map.set(item.order_id, list);
  }
  return map;
}

function sumTickets(
  orders: OrderRow[],
  items: Map<string, ItemRow[]>,
  start: Date,
  end: Date,
) {
  let paid = 0;
  let refunded = 0;
  let free = 0;
  let cancelled = 0;
  for (const order of orders) {
    const lines = items.get(order.id) ?? [];
    const paidQty = lines.filter((line) => embed(line.event_ticket_types)?.kind === "paid").reduce((sum, line) => sum + line.quantity, 0);
    const freeQty = lines.filter((line) => embed(line.event_ticket_types)?.kind === "free").reduce((sum, line) => sum + line.quantity, 0);
    const event = embed(order.events);
    if ((order.status === "paid" || order.status === "refunded") && inRange(order.paid_at, start, end)) {
      paid += paidQty;
      if (order.status === "paid") free += freeQty;
      if (event?.status === "cancelled") cancelled += paidQty;
    }
    if (order.status === "refunded" && inRange(order.refunded_at, start, end)) refunded += paidQty;
  }
  return { paid, refunded, free, cancelled };
}

function sumFees(orders: OrderRow[], start: Date, end: Date) {
  return orders
    .filter((order) => (order.status === "paid" || order.status === "refunded") && inRange(order.paid_at, start, end))
    .reduce((sum, order) => sum + venturoFeeCents({
      commissionCents: order.commission_cents ?? 0,
      bookingFeeCents: order.booking_fee_cents ?? 0,
    }), 0);
}

function sumGross(orders: OrderRow[], start: Date, end: Date) {
  return orders
    .filter((order) => (order.status === "paid" || order.status === "refunded") && inRange(order.paid_at, start, end))
    .reduce((sum, order) => sum + (order.subtotal_cents ?? 0), 0);
}

function sumRefunds(orders: OrderRow[], start: Date, end: Date) {
  return orders
    .filter((order) => order.status === "refunded" && inRange(order.refunded_at, start, end))
    .reduce((sum, order) => sum + (order.subtotal_cents ?? 0), 0);
}

function sumSubs(rows: { user_id: string | null; amount_cents: number; paid_at: string }[], start: Date, end: Date) {
  return rows.filter((row) => inRange(row.paid_at, start, end)).reduce((sum, row) => sum + row.amount_cents, 0);
}

async function loadActivity(
  service: SupabaseClient,
  since: Date,
  until: Date,
  platform: PlatformFilter,
  settings: OverviewSettings,
) {
  const startKey = johannesburgDateKey(since);
  const endKey = johannesburgDateKey(until);
  const pageSize = 1000;
  const rows: { user_id: string; day: string; platform: string }[] = [];
  for (let from = 0; from < 20_000; from += pageSize) {
    const { data, error } = await service
      .from("member_activity")
      .select("user_id, day, platform")
      .in("kind", [...USAGE_KINDS])
      .gte("day", startKey)
      .lte("day", endKey)
      .range(from, from + pageSize - 1);
    if (error) return null;
    const page = (data ?? []) as { user_id: string; day: string; platform: string }[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  const { count } = await service
    .from("member_activity")
    .select("user_id", { count: "exact", head: true })
    .in("kind", [...USAGE_KINDS])
    .eq("platform", platform === "all" ? "web" : platform)
    .limit(1);
  return {
    rows,
    platformSeen: platform === "all" ? true : (count ?? 0) > 0,
    startedAt: settings.activityStartedAt,
  };
}

function usersInRange(
  rows: { user_id: string; day: string; platform: string }[],
  start: Date,
  end: Date,
  platform: PlatformFilter,
  excluded: Set<string>,
) {
  const startKey = johannesburgDateKey(start);
  const endKey = johannesburgDateKey(end);
  return uniqueIds(
    rows
      .filter((row) => (platform === "all" || row.platform === platform) && row.day >= startKey && row.day <= endKey)
      .map((row) => row.user_id)
      .filter((id) => !excluded.has(id)),
  );
}

function activityCardFor(
  activity: Awaited<ReturnType<typeof loadActivity>>,
  platform: PlatformFilter,
  range: ReportRange,
  previous: { start: Date; end: Date },
  excluded: Set<string>,
): HeadlineCard {
  if (!activity) {
    return {
      label: "Active users",
      display: UNAVAILABLE,
      scope: range.label,
      comparison: UNAVAILABLE,
      hint: "Signed-in use is not available. Anonymous website visits stay out of this card.",
    };
  }
  if (platform !== "all" && !activity.platformSeen) {
    return {
      label: "Active users",
      display: UNAVAILABLE,
      scope: platformLabel(platform),
      comparison: UNAVAILABLE,
      hint: `${platformLabel(platform)} is not reporting scrolls or content views yet.`,
    };
  }
  const started = activity.startedAt ? new Date(activity.startedAt) : null;
  if (started && range.end.getTime() < started.getTime()) {
    return {
      label: "Active users",
      display: UNAVAILABLE,
      scope: range.label,
      comparison: UNAVAILABLE,
      hint: `Signed-in use is recorded from ${formatWhen(activity.startedAt, false)}.`,
    };
  }
  const current = usersInRange(activity.rows, range.start, range.end, platform, excluded);
  const priorReady = !started || previous.end.getTime() >= started.getTime();
  const prior = priorReady ? usersInRange(activity.rows, previous.start, previous.end, platform, excluded) : null;
  return {
    label: "Active users",
    display: formatCount(current),
    scope: `${range.label} · signed-in`,
    comparison: prior === null ? `Recorded from ${formatWhen(activity.startedAt, false)}` : percentDelta(current, prior),
    hint: "One count per signed-in person who scrolled, or opened a listing, event, or community. Anonymous visitors are not included.",
  };
}

async function loadAccounts(service: SupabaseClient, since: Date, excluded: Set<string>) {
  const { data, error } = await service
    .from("profiles")
    .select("id, created_at")
    .gte("created_at", since.toISOString())
    .limit(5000);
  if (error) return null;
  return notExcluded((data ?? []) as { id: string; created_at: string }[], excluded, "id");
}

function accountCardFor(
  accounts: { id: string; created_at: string }[] | null,
  platform: PlatformFilter,
  range: ReportRange,
  previous: { start: Date; end: Date },
): HeadlineCard {
  if (platform !== "all") {
    return {
      label: "New accounts",
      display: UNAVAILABLE,
      scope: platformLabel(platform),
      comparison: UNAVAILABLE,
      hint: "Signup platform is not stored, so this filter cannot be applied.",
    };
  }
  if (!accounts) {
    return {
      label: "New accounts",
      display: UNAVAILABLE,
      scope: range.label,
      comparison: UNAVAILABLE,
    };
  }
  const current = accounts.filter((row) => inRange(row.created_at, range.start, range.end)).length;
  const prior = accounts.filter((row) => inRange(row.created_at, previous.start, previous.end)).length;
  return {
    label: "New accounts",
    display: formatCount(current),
    scope: range.label,
    comparison: percentDelta(current, prior),
    href: "/admin/members",
    hint: "Profiles created in the period, excluding test accounts. The same person is one account.",
  };
}

async function loadMembers(service: SupabaseClient, excluded: Set<string>, platform: PlatformFilter) {
  let query = service.from("member_access").select("user_id, subscribed, payfast_active, revenuecat_active, current_period_end").eq("subscribed", true).limit(10000);
  if (platform === "web") query = query.eq("payfast_active", true);
  const { data, error } = await query;
  if (error) return null;
  if ((data ?? []).length >= 10000) return null;
  const rows = notExcluded((data ?? []) as { user_id: string; current_period_end: string | null }[], excluded, "user_id");
  return { current: rows.length, rows, gaps: 0 };
}

function memberCardFor(
  members: Awaited<ReturnType<typeof loadMembers>>,
  platform: PlatformFilter,
  comparison: string | null,
): HeadlineCard {
  if (platform === "ios" || platform === "android") {
    return {
      label: "Paid members",
      display: UNAVAILABLE,
      scope: "Current entitlement",
      comparison: UNAVAILABLE,
      hint: "RevenueCat entitlement is not split between iOS and Android.",
    };
  }
  if (!members) {
    return {
      label: "Paid members",
      display: UNAVAILABLE,
      scope: "Current entitlement",
      comparison: UNAVAILABLE,
    };
  }
  return {
    label: "Paid members",
    display: formatCount(members.current),
    scope: platform === "web" ? "Current website entitlement" : "Current entitlement",
    comparison: comparison ?? "Snapshot, not the selected period",
    href: platform === "web" ? "/admin/members?plan=paid&metrics=1" : "/admin/members?plan=paid&metrics=1",
    hint: "member_access.subscribed, one row per person. Website billing is payfast_active. App billing is revenuecat_active.",
  };
}

async function paidMemberComparison(
  service: SupabaseClient | null,
  members: Awaited<ReturnType<typeof loadMembers>>,
  platform: PlatformFilter,
  previousEnd: Date,
) {
  if (!service || !members || platform !== "all") return null;
  const { data, error } = await service
    .from("ops_metric_days")
    .select("value")
    .eq("day", johannesburgDateKey(previousEnd))
    .eq("metric_key", "paid_members")
    .eq("platform", "all")
    .maybeSingle();
  if (error || data?.value == null) return null;
  return percentDelta(members.current, Number(data.value));
}

async function loadSubscriptionCents(service: SupabaseClient, since: Date, excluded: Set<string>) {
  const { data, error } = await service
    .from("membership_payments")
    .select("user_id, amount_cents, paid_at")
    .gte("paid_at", since.toISOString())
    .limit(5000);
  if (error) return null;
  return notExcluded((data ?? []) as { user_id: string | null; amount_cents: number; paid_at: string }[], excluded, "user_id");
}

async function loadUpcoming(
  db: SupabaseClient,
  service: SupabaseClient | null,
  settings: OverviewSettings,
  now: Date,
  excluded: Set<string>,
  attention: AttentionItem[],
) {
  const until = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const { data, error } = await db
    .from("events")
    .select("id, title, slug, status, starts_at, ends_at, timezone, venue_name, organiser_id")
    .eq("status", "approved")
    .gte("starts_at", now.toISOString())
    .lte("starts_at", until)
    .order("starts_at", { ascending: true })
    .limit(100);
  if (error) return { state: "unavailable" as const, rows: [] as UpcomingRow[] };
  const events = data ?? [];
  if (!events.length) return { state: "empty" as const, rows: [] as UpcomingRow[] };

  const ids = events.map((event) => event.id as string);
  const organiserIds = [...new Set(events.map((event) => event.organiser_id as string).filter(Boolean))];
  const [types, tickets, profiles, payouts, orders] = await Promise.all([
    db.from("event_ticket_types").select("event_id, kind, quantity, sold_count, price_cents").in("event_id", ids),
    db.from("event_tickets").select("event_id, scanned_at").in("event_id", ids).not("scanned_at", "is", null),
    organiserIds.length
      ? db.from("profiles").select("id, first_name, last_name").in("id", organiserIds)
      : Promise.resolve({ data: [], error: null }),
    service && organiserIds.length
      ? service.from("organiser_payout_profiles").select("user_id").in("user_id", organiserIds)
      : Promise.resolve({ data: [], error: null }),
    service
      ? service
          .from("event_orders")
          .select("id, event_id, status, subtotal_cents, buyer_id, paid_at")
          .in("event_id", ids)
          .in("status", ["paid", "refunded"])
      : Promise.resolve({ data: null, error: { message: "no service" } }),
  ]);

  if (types.error) return { state: "unavailable" as const, rows: [] as UpcomingRow[] };

  const names = new Map<string, string>();
  for (const profile of profiles.data ?? []) {
    const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
    names.set(profile.id as string, name || "Host");
  }
  const banks = new Set((payouts.data ?? []).map((row) => row.user_id as string));
  const sales = new Map<string, number>();
  if (!orders.error && orders.data) {
    for (const order of orders.data as { event_id: string; status: string; subtotal_cents: number | null; buyer_id: string | null }[]) {
      if (order.buyer_id && excluded.has(order.buyer_id)) continue;
      if (order.status !== "paid") continue;
      sales.set(order.event_id, (sales.get(order.event_id) ?? 0) + (order.subtotal_cents ?? 0));
    }
  }
  const typeRows = (types.data ?? []) as {
    event_id: string;
    kind: string;
    quantity: number;
    sold_count: number;
    price_cents: number;
  }[];
  const checkins = new Map<string, number>();
  for (const ticket of tickets.data ?? []) {
    checkins.set(ticket.event_id as string, (checkins.get(ticket.event_id as string) ?? 0) + 1);
  }

  const today = johannesburgDateKey(now);
  const rows: UpcomingRow[] = events.map((event) => {
    const eventTypes = typeRows.filter((type) => type.event_id === event.id);
    const paid = eventTypes.filter((type) => type.kind === "paid").reduce((sum, type) => sum + (type.sold_count ?? 0), 0);
    const rsvps = eventTypes.filter((type) => type.kind === "free").reduce((sum, type) => sum + (type.sold_count ?? 0), 0);
    const capacity = eventTypes.reduce((sum, type) => sum + (type.quantity ?? 0), 0);
    const remaining = eventTypes.reduce((sum, type) => sum + Math.max(0, (type.quantity ?? 0) - (type.sold_count ?? 0)), 0);
    const issues: string[] = [];
    if (!event.starts_at) issues.push("No date");
    if (!event.venue_name) issues.push("No venue");
    if (!eventTypes.length) issues.push("No tickets");
    const paidTypes = eventTypes.filter((type) => type.kind === "paid" && (type.price_cents ?? 0) > 0);
    const payoutsKnown = Boolean(service) && !payouts.error;
    if (paidTypes.length && payoutsKnown && !banks.has(event.organiser_id as string)) issues.push("No payout account");
    const starts = event.starts_at ? new Date(event.starts_at as string) : null;
    const daysOut = starts ? (starts.getTime() - now.getTime()) / 86_400_000 : 99;
    const low =
      capacity > 0 &&
      daysOut <= settings.lowSalesWithinDays &&
      (paid / capacity) * 100 < settings.lowSalesPercent;
    if (low) issues.push("Low sales");
    const onDay = Boolean(event.starts_at) && johannesburgDateKey(new Date(event.starts_at as string)) === today;
    if (issues.length) {
      const age = ageFrom(event.starts_at as string, now);
      attention.push({
        id: `event-ready-${event.id}`,
        kind: "events",
        type: daysOut <= settings.overdueHours / 24 ? "Event deadline" : "Event setup",
        item: String(event.title ?? "Event"),
        severity: daysOut <= 2 ? "high" : "medium",
        age: starts && starts.getTime() > now.getTime() ? `In ${Math.max(1, Math.round(daysOut * 24))} h` : age.label,
        ageHours: daysOut <= 2 ? 5_000 : 100,
        href: `/admin/events/${event.id}`,
        owner: names.get(event.organiser_id as string) ?? null,
      });
    }
    return {
      id: event.id as string,
      href: `/admin/events/${event.id}`,
      title: String(event.title ?? "Event"),
      when: formatWhen(event.starts_at as string),
      host: names.get(event.organiser_id as string) ?? "Host",
      status: "Published",
      paid: formatCount(paid),
      rsvps: formatCount(rsvps),
      capacity: capacity > 0 ? `${formatCount(remaining)} left of ${formatCount(capacity)}` : "No limit set",
      sales: orders.error ? UNAVAILABLE : formatZar(sales.get(event.id as string) ?? 0),
      readiness: issues.length ? issues.join(" · ") : "Ready",
      checkIns: tickets.error ? UNAVAILABLE : onDay ? formatCount(checkins.get(event.id as string) ?? 0) : "—",
      warn: issues.length > 0,
    };
  });

  return { state: "ready" as const, rows };
}

async function loadIssued(service: SupabaseClient, orders: OrderRow[]) {
  const ids = orders.filter((order) => order.status === "paid").map((order) => order.id);
  const counts = new Map<string, number>();
  for (let index = 0; index < ids.length; index += 150) {
    const slice = ids.slice(index, index + 150);
    if (!slice.length) continue;
    const { data, error } = await service.from("event_tickets").select("order_id").in("order_id", slice);
    if (error) return null;
    for (const row of data ?? []) {
      const id = row.order_id as string;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

function assessFulfillment(
  orders: OrderRow[],
  items: Map<string, ItemRow[]>,
  issued: Map<string, number>,
  settings: OverviewSettings,
  now: Date,
  attention: AttentionItem[],
) {
  let ticketGaps = 0;
  let emailGaps = 0;
  for (const order of orders) {
    if (order.status !== "paid") continue;
    const lines = items.get(order.id) ?? [];
    const expected = lines.reduce((sum, line) => sum + line.quantity, 0);
    if (expected <= 0) continue;
    const got = issued.get(order.id) ?? 0;
    const event = embed(order.events);
    const age = ageFrom(order.paid_at, now);
    if (got < expected) {
      ticketGaps += 1;
      attention.push({
        id: `tickets-${order.id}`,
        kind: "tickets",
        type: "Payment without tickets",
        item: event?.title || "Order",
        severity: "critical",
        age: age.label,
        ageHours: age.hours + 20_000,
        href: `/admin/operations?status=paid&order=${order.id}`,
        owner: null,
      });
      continue;
    }
    if (
      order.paid_at &&
      new Date(order.paid_at).getTime() >= Date.parse("2026-10-20T00:00:00+02:00") &&
      age.hours * 60 >= settings.ticketEmailGraceMinutes &&
      !order.ticket_email_sent_at
    ) {
      emailGaps += 1;
      attention.push({
        id: `email-${order.id}`,
        kind: "tickets",
        type: "Ticket email missing",
        item: `${event?.title || "Order"} · paid ${formatWhen(order.paid_at)}`,
        severity: "critical",
        age: age.label,
        ageHours: age.hours + 12_000,
        href: `/admin/operations?status=paid&order=${order.id}`,
        owner: null,
      });
    }
  }
  return { ticketGaps, emailGaps };
}

function pushDiscountIssues(
  attention: AttentionItem[],
  orders: OrderRow[],
  items: Map<string, ItemRow[]>,
  range: ReportRange,
  now: Date,
) {
  for (const order of orders) {
    if (order.status !== "paid" || !order.used_member_pricing || !inRange(order.paid_at, range.start, range.end)) continue;
    for (const line of items.get(order.id) ?? []) {
      const type = embed(line.event_ticket_types);
      const kind = type?.member_discount_kind as MemberDiscountKind | undefined;
      if (!type || !kind || kind === "none" || type.price_cents == null) continue;
      const expected = memberPriceCentsFromDiscount(type.price_cents, kind, Number(type.member_discount_value));
      if (expected == null || line.unit_price_cents == null) continue;
      if (Math.abs(expected - line.unit_price_cents) > 1) {
        const event = embed(order.events);
        const age = ageFrom(order.paid_at, now);
        attention.push({
          id: `discount-${order.id}-${line.unit_price_cents}`,
          kind: "membership",
          type: "Member discount",
          item: event?.title || "Order",
          severity: "high",
          age: age.label,
          ageHours: age.hours + 8_000,
          href: `/admin/events/${order.event_id}`,
          owner: null,
        });
        break;
      }
    }
  }
}

function pushPayouts(attention: AttentionItem[], orders: OrderRow[], settings: OverviewSettings, now: Date, excluded: Set<string>) {
  for (const order of notExcluded(orders, excluded, "buyer_id")) {
    const event = embed(order.events);
    if (!event?.ends_at) continue;
    const due = new Date(new Date(event.ends_at).getTime() + settings.payoutDueDays * 86_400_000);
    if (due.getTime() > now.getTime()) continue;
    const age = ageFrom(due.toISOString(), now);
    attention.push({
      id: `payout-${order.id}`,
      kind: "payout",
      type: "Overdue host payout",
      item: event.title || "Event",
      severity: "high",
      age: age.label,
      ageHours: age.hours + 9_000,
      href: "/admin/operations?status=owed",
      owner: null,
    });
  }
}

function summarisePayouts(orders: OrderRow[] | null, excluded: Set<string>, settings: OverviewSettings, now: Date) {
  if (!orders) return null;
  let owed = 0;
  let overdue = 0;
  let overdueCount = 0;
  let next: Date | null = null;
  for (const order of notExcluded(orders, excluded, "buyer_id")) {
    const amount = hostOwedCents({
      subtotalCents: order.subtotal_cents ?? 0,
      commissionCents: order.commission_cents ?? 0,
      bookingFeeCents: order.booking_fee_cents ?? 0,
      totalCents: order.total_cents ?? 0,
    });
    owed += amount;
    const event = embed(order.events);
    if (!event?.ends_at) continue;
    const due = new Date(new Date(event.ends_at).getTime() + settings.payoutDueDays * 86_400_000);
    if (due.getTime() <= now.getTime()) {
      overdue += amount;
      overdueCount += 1;
    } else if (!next || due.getTime() < next.getTime()) next = due;
  }
  return { owed, overdue, overdueCount, nextDue: next ? formatWhen(next.toISOString(), false) : null };
}

async function pushMembershipIssues(
  service: SupabaseClient,
  excluded: Set<string>,
  settings: OverviewSettings,
  now: Date,
  attention: AttentionItem[],
  platform: PlatformFilter,
) {
  if (platform === "ios" || platform === "android") return null;
  const { data, error } = await service
    .from("memberships")
    .select("id, user_id, status, current_period_end, updated_at")
    .in("status", ["active", "failed"])
    .limit(2000);
  if (error || !data) return null;
  const rows = notExcluded(data as { id: string; user_id: string; status: string; current_period_end: string | null; updated_at: string }[], excluded, "user_id");
  const ids = rows.map((row) => row.user_id);
  const access = new Map<string, { subscribed: boolean; current_period_end: string | null }>();
  let gaps = 0;
  for (let index = 0; index < ids.length; index += 150) {
    const slice = ids.slice(index, index + 150);
    if (!slice.length) continue;
    const result = await service.from("member_access").select("user_id, subscribed, current_period_end").in("user_id", slice);
    if (result.error) return null;
    for (const row of result.data ?? []) {
      access.set(row.user_id as string, {
        subscribed: Boolean(row.subscribed),
        current_period_end: (row.current_period_end as string | null) ?? null,
      });
    }
  }
  let ending = 0;
  const horizon = now.getTime() + settings.membershipEndingDays * 86_400_000;
  for (const row of rows) {
    const entitlement = access.get(row.user_id);
    if (row.status === "active" && !entitlement?.subscribed) {
      gaps += 1;
      const age = ageFrom(row.updated_at, now);
      attention.push({
        id: `access-${row.id}`,
        kind: "membership",
        type: "Membership not applied",
        item: "Paid membership without entitlement",
        severity: "critical",
        age: age.label,
        ageHours: age.hours + 15_000,
        href: "/admin/members?plan=paid&metrics=1",
        owner: null,
      });
    }
    if (row.status === "failed") {
      const age = ageFrom(row.updated_at, now);
      attention.push({
        id: `renew-${row.id}`,
        kind: "membership",
        type: "Failed renewal",
        item: "Membership renewal failed",
        severity: "high",
        age: age.label,
        ageHours: age.hours + 7_000,
        href: "/admin/members",
        owner: null,
      });
    }
    const end = entitlement?.current_period_end ?? row.current_period_end;
    if (entitlement?.subscribed && end) {
      const time = new Date(end).getTime();
      if (time >= now.getTime() && time <= horizon) ending += 1;
    }
  }
  if (ending > 0) {
    attention.push({
      id: "membership-ending",
      kind: "membership",
      type: "Membership ending",
      item: `${formatCount(ending)} paid membership${ending === 1 ? "" : "s"} end within ${settings.membershipEndingDays} days`,
      severity: "medium",
      age: `${settings.membershipEndingDays} d`,
      ageHours: 50,
      href: "/admin/members?plan=paid&metrics=1",
      owner: null,
    });
  }
  return gaps;
}

async function pushEnquiries(db: SupabaseClient, settings: OverviewSettings, now: Date, attention: AttentionItem[]) {
  const { data, error } = await db
    .from("enquiries")
    .select("id, name, created_at, resolved_at")
    .is("resolved_at", null)
    .order("created_at", { ascending: true })
    .limit(30);
  if (error) {
    if (missingRelation(error)) return;
    return;
  }
  for (const row of data ?? []) {
    const age = ageFrom(row.created_at as string, now);
    if (age.hours < settings.overdueHours) continue;
    attention.push({
      id: `enquiry-${row.id}`,
      kind: "enquiry",
      type: "Customer message",
      item: String(row.name ?? "Enquiry"),
      severity: "medium",
      age: age.label,
      ageHours: age.hours,
      href: "/admin/enquiries",
      owner: null,
    });
  }
}

async function loadInsights(input: {
  service: SupabaseClient | null;
  range: ReportRange;
  platform: PlatformFilter;
  excludedOk: boolean;
  excluded: Set<string>;
}) {
  const insights: Insight[] = [];
  const saveParams = new URLSearchParams({ range: input.range.key });
  if (input.range.key === "custom") {
    saveParams.set("from", johannesburgDateKey(input.range.start));
    saveParams.set("to", johannesburgDateKey(input.range.end));
  }
  const saves = await loadPopularSaves({
    service: input.service,
    excludedOk: input.excludedOk,
    excluded: input.excluded,
    start: input.range.start,
    end: input.range.end,
  });
  insights.push({
    title: "Popular saves",
    body: popularSavesSummary(saves, input.range.label),
    href: saves.state === "ready" ? `/admin/saves?${saveParams.toString()}` : undefined,
  });

  const misses = await loadSearchMisses({
    service: input.service,
    excludedOk: input.excludedOk,
    excluded: input.excluded,
    start: input.range.start,
    end: input.range.end,
    platform: input.platform,
  });
  const popular = await loadPopularSearches({
    service: input.service,
    excludedOk: input.excludedOk,
    excluded: input.excluded,
    start: input.range.start,
    end: input.range.end,
    platform: input.platform,
  });
  const missParams = new URLSearchParams({ range: input.range.key, platform: input.platform });
  if (input.range.key === "custom") {
    missParams.set("from", johannesburgDateKey(input.range.start));
    missParams.set("to", johannesburgDateKey(input.range.end));
  }
  insights.push({
    title: "Most searched",
    body: searchPopularSummary(popular, input.range.label),
    href: popular.state === "ready" ? `/admin/searches?${missParams.toString()}` : undefined,
  });
  insights.push({
    title: "Searches with no results",
    body: searchMissSummary(misses, input.range.label),
    href: misses.state === "ready" ? `/admin/search-misses?${missParams.toString()}` : undefined,
  });

  const interests = await loadInterestCoverage({
    service: input.service,
    excludedOk: input.excludedOk,
    excluded: input.excluded,
  });
  const areas = await loadAreaCoverage({
    service: input.service,
    excludedOk: input.excludedOk,
    excluded: input.excluded,
  });
  insights.push({
    title: "Interests with little content",
    body: interestCoverageSummary(interests),
    href: interests.state === "ready" ? "/admin/interests" : undefined,
  });
  insights.push({
    title: "Thin areas",
    body: areaCoverageSummary(areas),
    href: areas.state === "ready" ? "/admin/areas" : undefined,
  });

  return insights;
}

function healthRows(input: { now: Date; ticketGaps: number | null; emailGaps: number | null; membershipGaps: number | null }): HealthRow[] {
  const checked = formatWhen(input.now.toISOString());
  const data = (name: string, gaps: number | null, failing: string, clear: string): HealthRow => {
    if (gaps === null) return { name, label: "Unknown", tone: "unknown", checked: "Not monitored" };
    if (gaps > 0) return { name, label: failing, tone: "failing", checked };
    return { name, label: clear, tone: "healthy", checked };
  };
  return [
    { name: "Website", label: "Unknown", tone: "unknown", checked: "Not monitored" },
    { name: "iOS", label: "Unknown", tone: "unknown", checked: "Not monitored" },
    { name: "Android", label: "Unknown", tone: "unknown", checked: "Not monitored" },
    { name: "Backend / API", label: "Unknown", tone: "unknown", checked: "Not monitored" },
    { name: "Payments", label: "Unknown", tone: "unknown", checked: "Not monitored" },
    data("Ticket issuance", input.ticketGaps, "Paid orders missing tickets", "No open ticket gaps"),
    data("Ticket email", input.emailGaps, "Ticket emails not sent", "No open email gaps"),
    { name: "Wallet access", label: "Unknown", tone: "unknown", checked: "Not monitored" },
    data("Membership access", input.membershipGaps, "Paid memberships missing entitlement", "No open entitlement gaps"),
  ];
}

async function writeSnapshots(
  service: SupabaseClient | null,
  now: Date,
  commerce: { paidMembers: number | null; upcomingEvents: number | null },
  content: { liveListings: number | null; liveCommunities: number | null; publishedGuides: number | null },
) {
  if (!service) return;
  const day = johannesburgDateKey(now);
  const rows = [
    ["paid_members", commerce.paidMembers],
    ["upcoming_events_7d", commerce.upcomingEvents],
    ["live_listings", content.liveListings],
    ["live_communities", content.liveCommunities],
    ["published_guides", content.publishedGuides],
  ]
    .filter((row): row is [string, number] => typeof row[1] === "number")
    .map(([metric_key, value]) => ({ day, metric_key, platform: "all", value, recorded_at: now.toISOString() }));
  if (!rows.length) return;
  await service.from("ops_metric_days").upsert(rows, { onConflict: "day,metric_key,platform" });
}

const DEFINITIONS: { title: string; body: string }[] = [
  {
    title: "Active users",
    body: "Distinct signed-in people who opened the website or app and used it: they scrolled, or they opened a business listing, event, or community. One person counts once across platforms. Opening a page without one of those actions does not count. Anonymous website visitors stay in the separate visit tables. iOS and Android count when the app reports the same actions.",
  },
  {
    title: "New accounts",
    body: "Profiles created in the period, excluding test emails and accounts marked exclude_from_metrics. Signup platform is not stored.",
  },
  {
    title: "Paid members",
    body: "Current member_access.subscribed rows, one per person. This is a snapshot. Website and app entitlements are the flags behind subscribed. A daily copy is kept in ops_metric_days.",
  },
  {
    title: "Paid tickets sold",
    body: "Quantity of paid ticket lines whose payment succeeded in the period. Free RSVPs and donation tickets are excluded. Refunded quantities are shown beside this number and are not added to it as a second sale.",
  },
  {
    title: "Venturo revenue",
    body: "Ticketing commission and booking fees on successful payments, plus website membership charges. Host ticket sales are not included. Paystack gateway fees and App Store or Play proceeds are not in the ledger.",
  },
  {
    title: "Host payouts",
    body: "Owed host money is the order subtotal, minus commission and booking fees that were not added on top of the buyer total. A payout is overdue the configured number of days after the event ends while payout_status is owed.",
  },
  {
    title: "History",
    body: "Orders, tickets, membership payments, enquiries, and audit rows are kept. Refunds stamp refunded_at instead of erasing paid_at. Daily stock totals are upserted into ops_metric_days and that table refuses deletes.",
  },
];
