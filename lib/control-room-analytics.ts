import {
  loadRemoteAnalyticsFromCache,
  refreshRemoteAnalytics,
  type RemoteAnalytics,
} from "@/lib/analytics-remote";
import type { AnalyticsRange } from "@/lib/analytics-range";
import { johannesburgDay, shiftDay, type DayPoint } from "@/lib/portal-home";
import {
  formatStay,
  publicPageLabel,
  screenLabel,
  type AppItemKind,
} from "@/lib/site-visit-path";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const LIVE_WINDOW_MS = 5 * 60 * 1000;
const CHART_DAYS = 7;
const DOWNLOAD_CHART_DAYS = 30;

export type ControlRoomAnalytics = {
  onSiteNow: number;
  visitsToday: number;
  pageviewsToday: number;
  visits7d: number;
  pageviews7d: number;
  visitorSeries: DayPoint[];
  pageviewSeries: DayPoint[];
  accounts: number;
  accounts7d: number;
  members: number;
  membersPayfast: number;
  membersApp: number;
  iosDownloads: number;
  androidDownloads: number;
  iosToday: number;
  androidToday: number;
  ios7d: number;
  android7d: number;
  iosSeries: DayPoint[];
  androidSeries: DayPoint[];
  downloadsRecordedAt: string | null;
  iosSource: string;
  androidSource: string;
  iosError: string | null;
  androidError: string | null;
  remote: RemoteAnalytics;
  pages: PageAnalyticsRow[];
};

export type PageAnalyticsRow = {
  path: string;
  label: string;
  visits: number;
  visitors: number;
  stay: string;
};

export type ScreenAnalyticsRow = {
  screen: string;
  label: string;
  opens: number;
  visitors: number;
};

export type ItemAnalyticsRow = {
  id: string;
  name: string;
  opens: number;
  visitors: number;
};

export type AppAnalytics = {
  screens: ScreenAnalyticsRow[];
  listings: ItemAnalyticsRow[];
  events: ItemAnalyticsRow[];
  communities: ItemAnalyticsRow[];
  guides: ItemAnalyticsRow[];
};

function emptySeries(days: number): DayPoint[] {
  const today = johannesburgDay();
  const points: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    points.push({ day: shiftDay(today, -i), value: 0 });
  }
  return points;
}

function blankAnalytics(): ControlRoomAnalytics {
  const series = emptySeries(CHART_DAYS);
  return {
    onSiteNow: 0,
    visitsToday: 0,
    pageviewsToday: 0,
    visits7d: 0,
    pageviews7d: 0,
    visitorSeries: series,
    pageviewSeries: series.map((point) => ({ ...point })),
    accounts: 0,
    accounts7d: 0,
    members: 0,
    membersPayfast: 0,
    membersApp: 0,
    iosDownloads: 0,
    androidDownloads: 0,
    iosToday: 0,
    androidToday: 0,
    ios7d: 0,
    android7d: 0,
    iosSeries: emptySeries(DOWNLOAD_CHART_DAYS),
    androidSeries: emptySeries(DOWNLOAD_CHART_DAYS),
    downloadsRecordedAt: null,
    iosSource: "none",
    androidSource: "none",
    iosError: null,
    androidError: null,
    pages: [],
    remote: {
      ios: { value: null, today: null, source: "none", error: null, fetchedAt: null },
      android: { value: null, today: null, source: "none", error: null, fetchedAt: null },
      revenueCat: {
        activeSubscriptions: null,
        activeTrials: null,
        newCustomers28d: null,
        mrr: null,
        revenue28d: null,
        currency: null,
        source: "none",
        error: null,
        fetchedAt: null,
      },
    },
  };
}

export function formatAnalyticsCount(n: number) {
  return new Intl.NumberFormat("en-ZA").format(Number.isFinite(n) ? n : 0);
}

export function formatAnalyticsMoney(value: number | null, currency = "USD") {
  if (value === null || !Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value)} ${currency}`;
  }
}

export async function loadControlRoomAnalytics(range: AnalyticsRange): Promise<ControlRoomAnalytics> {
  const blank = blankAnalytics();
  const supabase = createServiceClient() ?? (await createClient());
  if (!supabase) return blank;

  const today = johannesburgDay();
  const start14 = shiftDay(today, -(CHART_DAYS - 1));
  const start7 = shiftDay(today, -6);
  const liveSince = new Date(Date.now() - LIVE_WINDOW_MS).toISOString();
  const weekStartIso = `${start7}T00:00:00+02:00`;

  let remote = await loadRemoteAnalyticsFromCache();
  try {
    remote = await refreshRemoteAnalytics(false);
  } catch (error) {
    console.error("[analytics remote]", error instanceof Error ? error.message : error);
  }

  const [
    daysRes,
    liveRes,
    accountsRes,
    accounts7Res,
    membersRes,
    payfastRes,
    appRes,
    downloadsRes,
    iosDaysRes,
    androidDaysRes,
    pagesRes,
    pageUniquesRes,
  ] = await Promise.all([
    supabase
      .from("site_visit_days")
      .select("day, pageviews, visitors")
      .gte("day", start14)
      .lte("day", today),
    supabase
      .from("site_visit_presence")
      .select("visitor_key", { count: "exact", head: true })
      .gte("last_seen", liveSince),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekStartIso),
    supabase
      .from("member_access")
      .select("user_id", { count: "exact", head: true })
      .eq("subscribed", true),
    supabase
      .from("member_access")
      .select("user_id", { count: "exact", head: true })
      .eq("payfast_active", true),
    supabase
      .from("member_access")
      .select("user_id", { count: "exact", head: true })
      .eq("revenuecat_active", true),
    supabase
      .from("app_download_snapshots")
      .select("ios_downloads, android_downloads, recorded_at")
      .order("recorded_at", { ascending: false })
      .limit(1),
    supabase
      .from("store_download_days")
      .select("day, downloads")
      .eq("platform", "ios")
      .gte("day", shiftDay(today, -(DOWNLOAD_CHART_DAYS - 1)))
      .lte("day", today),
    supabase
      .from("store_download_days")
      .select("day, downloads")
      .eq("platform", "android")
      .gte("day", shiftDay(today, -(DOWNLOAD_CHART_DAYS - 1)))
      .lte("day", today),
    supabase
      .from("site_visit_page_days")
      .select("path, pageviews, visitors, dwell_seconds")
      .gte("day", range.from)
      .lte("day", range.to),
    supabase
      .from("site_visit_page_uniques")
      .select("path, visitor_key")
      .gte("day", range.from)
      .lte("day", range.to),
  ]);

  const visitorMap = new Map<string, number>();
  const pageviewMap = new Map<string, number>();
  let visits7d = 0;
  let pageviews7d = 0;
  for (const row of daysRes.data ?? []) {
    const day = String(row.day);
    const visitors = Number(row.visitors) || 0;
    const pageviews = Number(row.pageviews) || 0;
    visitorMap.set(day, visitors);
    pageviewMap.set(day, pageviews);
    if (day >= start7) {
      visits7d += visitors;
      pageviews7d += pageviews;
    }
  }

  const snapshot = downloadsRes.data?.[0];
  const visitsToday = visitorMap.get(today) ?? 0;
  const pageviewsToday = pageviewMap.get(today) ?? 0;
  const iosMap = new Map<string, number>();
  const androidMap = new Map<string, number>();
  for (const row of iosDaysRes.data ?? []) iosMap.set(String(row.day), Number(row.downloads) || 0);
  for (const row of androidDaysRes.data ?? []) androidMap.set(String(row.day), Number(row.downloads) || 0);
  const iosSeries = emptySeries(DOWNLOAD_CHART_DAYS).map((point) => ({
    day: point.day,
    value: iosMap.get(point.day) ?? 0,
  }));
  const androidSeries = emptySeries(DOWNLOAD_CHART_DAYS).map((point) => ({
    day: point.day,
    value: androidMap.get(point.day) ?? 0,
  }));
  const start7Day = shiftDay(today, -6);
  const iosToday = remote.ios.today ?? iosMap.get(today) ?? 0;
  const androidToday = remote.android.today ?? androidMap.get(today) ?? 0;
  const ios7d = iosSeries.filter((point) => point.day >= start7Day).reduce((sum, point) => sum + point.value, 0);
  const android7d = androidSeries.filter((point) => point.day >= start7Day).reduce((sum, point) => sum + point.value, 0);
  const snapshotIos = Number(snapshot?.ios_downloads);
  const snapshotAndroid = Number(snapshot?.android_downloads);
  const iosDownloads = remote.ios.value ?? (Number.isFinite(snapshotIos) ? snapshotIos : 0);
  const androidDownloads = remote.android.value ?? (Number.isFinite(snapshotAndroid) ? snapshotAndroid : 0);

  return {
    onSiteNow: liveRes.count ?? 0,
    visitsToday,
    pageviewsToday,
    visits7d,
    pageviews7d,
    visitorSeries: blank.visitorSeries.map((point) => ({
      day: point.day,
      value: visitorMap.get(point.day) ?? 0,
    })),
    pageviewSeries: blank.pageviewSeries.map((point) => ({
      day: point.day,
      value: pageviewMap.get(point.day) ?? 0,
    })),
    accounts: accountsRes.count ?? 0,
    accounts7d: accounts7Res.count ?? 0,
    members: membersRes.count ?? 0,
    membersPayfast: payfastRes.count ?? 0,
    membersApp: appRes.count ?? 0,
    iosDownloads,
    androidDownloads,
    iosToday,
    androidToday,
    ios7d,
    android7d,
    iosSeries,
    androidSeries,
    downloadsRecordedAt: remote.ios.fetchedAt ?? remote.android.fetchedAt ?? snapshot?.recorded_at ?? null,
    iosSource: remote.ios.source,
    androidSource: remote.android.source,
    iosError: remote.ios.error,
    androidError: remote.android.error,
    remote,
    pages: await summarisePages(
      supabase as Awaited<ReturnType<typeof createClient>>,
      pagesRes.data ?? [],
      distinctCounts(pageUniquesRes.data ?? [], "path", "visitor_key"),
    ),
  };
}

function distinctCounts(
  rows: Record<string, unknown>[],
  groupKey: string,
  uniqueKey: string,
) {
  const sets = new Map<string, Set<string>>();
  for (const row of rows) {
    const group = String(row[groupKey] ?? "");
    const unique = String(row[uniqueKey] ?? "");
    if (!group || !unique) continue;
    const set = sets.get(group) ?? new Set<string>();
    set.add(unique);
    sets.set(group, set);
  }
  const counts = new Map<string, number>();
  for (const [group, set] of sets) counts.set(group, set.size);
  return counts;
}

async function summarisePages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: { path: string; pageviews: number; visitors: number; dwell_seconds: number }[],
  uniques: Map<string, number>,
): Promise<PageAnalyticsRow[]> {
  const byPath = new Map<string, { visits: number; dwell: number }>();
  for (const row of rows) {
    const path = String(row.path);
    const current = byPath.get(path) ?? { visits: 0, dwell: 0 };
    current.visits += Number(row.pageviews) || 0;
    current.dwell += Number(row.dwell_seconds) || 0;
    byPath.set(path, current);
  }
  const titles = await pageTitles(supabase, [...byPath.keys()]);
  return [...byPath.entries()]
    .map(([path, stats]) => ({
      path,
      label: publicPageLabel(path, titles),
      visits: stats.visits,
      visitors: uniques.get(path) ?? 0,
      stay: formatStay(stats.dwell, stats.visits),
    }))
    .sort((a, b) => b.visits - a.visits || a.label.localeCompare(b.label, "en-ZA"));
}

async function pageTitles(supabase: Awaited<ReturnType<typeof createClient>>, paths: string[]) {
  const titles = new Map<string, string>();
  if (!supabase) return titles;
  const eventSlugs = paths.map((path) => path.match(/^\/events\/([^/]+)$/)?.[1]).filter(Boolean) as string[];
  const listingSlugs = paths.map((path) => path.match(/^\/directory\/([^/]+)$/)?.[1]).filter(Boolean) as string[];
  const guideSlugs = paths
    .map((path) => path.match(/^\/(?:event-guides|guides)\/([^/]+)$/)?.[1])
    .filter(Boolean) as string[];
  const communitySlugs = paths
    .map((path) => path.match(/^\/communities\/([^/]+)$/)?.[1])
    .filter(Boolean) as string[];
  const [events, listings, guides, communities] = await Promise.all([
    eventSlugs.length
      ? supabase.from("events").select("slug, title").in("slug", eventSlugs)
      : { data: [] as { slug: string; title: string }[] },
    listingSlugs.length
      ? supabase.from("directory_listings").select("slug, name").in("slug", listingSlugs)
      : { data: [] as { slug: string; name: string }[] },
    guideSlugs.length
      ? supabase.from("curated_guides").select("slug, title").in("slug", guideSlugs)
      : { data: [] as { slug: string; title: string }[] },
    communitySlugs.length
      ? supabase.from("communities").select("slug, title").in("slug", communitySlugs)
      : { data: [] as { slug: string; title: string }[] },
  ]);
  for (const row of events.data ?? []) titles.set(`event:${row.slug}`, row.title);
  for (const row of listings.data ?? []) titles.set(`listing:${row.slug}`, row.name);
  for (const row of guides.data ?? []) titles.set(`guide:${row.slug}`, row.title);
  for (const row of communities.data ?? []) titles.set(`community:${row.slug}`, row.title);
  return titles;
}

export async function loadAppAnalytics(range: AnalyticsRange): Promise<AppAnalytics> {
  const empty: AppAnalytics = { screens: [], listings: [], events: [], communities: [], guides: [] };
  const supabase = createServiceClient() ?? (await createClient());
  if (!supabase) return empty;

  const [screenDays, screenUniques, itemDays, itemUniques] = await Promise.all([
    supabase.from("app_screen_days").select("screen, opens").gte("day", range.from).lte("day", range.to),
    supabase.from("app_screen_uniques").select("screen, user_id").gte("day", range.from).lte("day", range.to),
    supabase.from("app_item_days").select("kind, item_id, opens").gte("day", range.from).lte("day", range.to),
    supabase.from("app_item_uniques").select("kind, item_id, user_id").gte("day", range.from).lte("day", range.to),
  ]);

  const screenUnique = distinctCounts(screenUniques.data ?? [], "screen", "user_id");
  const byScreen = new Map<string, number>();
  for (const row of screenDays.data ?? []) {
    const screen = String(row.screen);
    byScreen.set(screen, (byScreen.get(screen) ?? 0) + (Number(row.opens) || 0));
  }
  const screens = [...byScreen.entries()]
    .map(([screen, opens]) => ({
      screen,
      label: screenLabel(screen),
      opens,
      visitors: screenUnique.get(screen) ?? 0,
    }))
    .sort((a, b) => b.opens - a.opens || a.label.localeCompare(b.label, "en-ZA"));

  const itemUnique = new Map<string, Set<string>>();
  for (const row of itemUniques.data ?? []) {
    const key = `${row.kind}:${row.item_id}`;
    const set = itemUnique.get(key) ?? new Set<string>();
    set.add(String(row.user_id));
    itemUnique.set(key, set);
  }
  const byItem = new Map<string, { kind: AppItemKind; id: string; opens: number }>();
  for (const row of itemDays.data ?? []) {
    const kind = String(row.kind) as AppItemKind;
    const id = String(row.item_id);
    const key = `${kind}:${id}`;
    const current = byItem.get(key) ?? { kind, id, opens: 0 };
    current.opens += Number(row.opens) || 0;
    byItem.set(key, current);
  }

  const ids = {
    listing: [] as string[],
    event: [] as string[],
    community: [] as string[],
    guide: [] as string[],
  };
  for (const item of byItem.values()) {
    if (item.kind in ids) ids[item.kind].push(item.id);
  }

  const names = await itemNames(supabase as Awaited<ReturnType<typeof createClient>>, ids);
  const toRows = (kind: AppItemKind): ItemAnalyticsRow[] =>
    [...byItem.values()]
      .filter((item) => item.kind === kind)
      .map((item) => ({
        id: item.id,
        name: names.get(`${kind}:${item.id}`) ?? item.id,
        opens: item.opens,
        visitors: itemUnique.get(`${kind}:${item.id}`)?.size ?? 0,
      }))
      .sort((a, b) => b.opens - a.opens || a.name.localeCompare(b.name, "en-ZA"));

  return {
    screens,
    listings: toRows("listing"),
    events: toRows("event"),
    communities: toRows("community"),
    guides: toRows("guide"),
  };
}

async function itemNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: { listing: string[]; event: string[]; community: string[]; guide: string[] },
) {
  const names = new Map<string, string>();
  if (!supabase) return names;
  const [listings, events, communities, guides] = await Promise.all([
    ids.listing.length
      ? supabase.from("directory_listings").select("id, name").in("id", ids.listing)
      : { data: [] as { id: string; name: string }[] },
    ids.event.length
      ? supabase.from("events").select("id, title").in("id", ids.event)
      : { data: [] as { id: string; title: string }[] },
    ids.community.length
      ? supabase.from("communities").select("id, title").in("id", ids.community)
      : { data: [] as { id: string; title: string }[] },
    ids.guide.length
      ? supabase.from("curated_guides").select("id, title").in("id", ids.guide)
      : { data: [] as { id: string; title: string }[] },
  ]);
  for (const row of listings.data ?? []) names.set(`listing:${row.id}`, row.name);
  for (const row of events.data ?? []) names.set(`event:${row.id}`, row.title);
  for (const row of communities.data ?? []) names.set(`community:${row.id}`, row.title);
  for (const row of guides.data ?? []) names.set(`guide:${row.id}`, row.title);
  return names;
}
