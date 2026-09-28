import {
  loadRemoteAnalyticsFromCache,
  refreshRemoteAnalytics,
  type RemoteAnalytics,
} from "@/lib/analytics-remote";
import { johannesburgDay, shiftDay, type DayPoint } from "@/lib/portal-home";
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

export async function loadControlRoomAnalytics(): Promise<ControlRoomAnalytics> {
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
  };
}
