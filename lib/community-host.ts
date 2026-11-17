import "server-only";

import type { AnalyticsRange } from "@/lib/analytics-range";
import { shiftDay } from "@/lib/portal-home";
import { createServiceClient } from "@/lib/supabase/admin";

export async function canManageCommunity(userId: string, communityId: string, staff = false) {
  if (staff) return true;
  const service = createServiceClient();
  if (!service) return false;
  const { data } = await service
    .from("community_managers")
    .select("community_id")
    .eq("community_id", communityId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return Boolean(data);
}

export type CommunityHostAnalytics = {
  website: { views: number; visitors: number; trend: { day: string; value: number }[] };
  app: { views: number; visitors: number };
  followers: { total: number; follows: number; unfollows: number; net: number; trend: { day: string; value: number }[] };
};

function rangeDays(range: AnalyticsRange) {
  const result: { day: string; value: number }[] = [];
  let day = range.from;
  while (day <= range.to && result.length < 366) {
    result.push({ day, value: 0 });
    day = shiftDay(day, 1);
  }
  return result;
}

export async function loadCommunityHostAnalytics(
  communityId: string,
  slug: string,
  range: AnalyticsRange,
): Promise<CommunityHostAnalytics> {
  const service = createServiceClient();
  const empty = {
    website: { views: 0, visitors: 0, trend: rangeDays(range) },
    app: { views: 0, visitors: 0 },
    followers: { total: 0, follows: 0, unfollows: 0, net: 0, trend: rangeDays(range) },
  };
  if (!service) return empty;
  const from = `${range.from}T00:00:00+02:00`;
  const to = `${shiftDay(range.to, 1)}T00:00:00+02:00`;
  const path = `/communities/${slug}`;
  const [web, appDays, appUnique, totalFollowers, followEvents] = await Promise.all([
    service
      .from("analytics_events")
      .select("visitor_key, occurred_at, analytics_sessions!inner(traffic_class, is_staff)")
      .eq("name", "page_view")
      .eq("path", path)
      .eq("analytics_sessions.is_staff", false)
      .in("analytics_sessions.traffic_class", ["likely_human", "unknown"])
      .gte("occurred_at", from)
      .lt("occurred_at", to),
    service
      .from("app_item_days")
      .select("day, opens")
      .eq("kind", "community")
      .eq("item_id", communityId)
      .gte("day", range.from)
      .lte("day", range.to),
    service
      .from("app_item_uniques")
      .select("user_id")
      .eq("kind", "community")
      .eq("item_id", communityId)
      .gte("day", range.from)
      .lte("day", range.to),
    service
      .from("community_follows")
      .select("user_id", { count: "exact", head: true })
      .eq("community_id", communityId),
    service
      .from("community_follow_events")
      .select("action, occurred_at")
      .eq("community_id", communityId)
      .in("action", ["follow", "unfollow"])
      .gte("occurred_at", from)
      .lt("occurred_at", to),
  ]);

  const websiteVisitors = new Set<string>();
  const webByDay = new Map<string, number>();
  for (const row of web.data ?? []) {
    websiteVisitors.add(String(row.visitor_key));
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date(row.occurred_at));
    webByDay.set(day, (webByDay.get(day) ?? 0) + 1);
  }
  const followByDay = new Map<string, number>();
  let follows = 0;
  let unfollows = 0;
  for (const row of followEvents.data ?? []) {
    const delta = row.action === "follow" ? 1 : -1;
    if (delta > 0) follows += 1;
    else unfollows += 1;
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date(row.occurred_at));
    followByDay.set(day, (followByDay.get(day) ?? 0) + delta);
  }
  const appVisitors = new Set((appUnique.data ?? []).map((row) => String(row.user_id)));
  return {
    website: {
      views: web.data?.length ?? 0,
      visitors: websiteVisitors.size,
      trend: rangeDays(range).map((point) => ({ ...point, value: webByDay.get(point.day) ?? 0 })),
    },
    app: {
      views: (appDays.data ?? []).reduce((sum, row) => sum + (Number(row.opens) || 0), 0),
      visitors: appVisitors.size,
    },
    followers: {
      total: totalFollowers.count ?? 0,
      follows,
      unfollows,
      net: follows - unfollows,
      trend: rangeDays(range).map((point) => ({ ...point, value: followByDay.get(point.day) ?? 0 })),
    },
  };
}

export async function listVisibleCommunityFollowers(communityId: string) {
  const service = createServiceClient();
  if (!service) return [];
  const { data } = await service
    .from("community_follows")
    .select("user_id, created_at, profiles(display_name, first_name, avatar_path)")
    .eq("community_id", communityId)
    .eq("host_visible", true)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      userId: String(row.user_id),
      name: profile?.display_name || profile?.first_name || "Venturo member",
      avatarPath: profile?.avatar_path ? String(profile.avatar_path) : null,
      followedAt: String(row.created_at),
    };
  });
  const paths = rows.flatMap((row) => (row.avatarPath ? [row.avatarPath] : []));
  const signed = paths.length ? await service.storage.from("avatars").createSignedUrls(paths, 3600) : { data: [] };
  const urls = new Map(paths.map((path, index) => [path, signed.data?.[index]?.signedUrl ?? null]));
  return rows.map((row) => ({ ...row, avatarUrl: row.avatarPath ? urls.get(row.avatarPath) ?? null : null }));
}

export async function listCommunityFollowPreferences(userId: string) {
  const service = createServiceClient();
  const result = new Map<string, {
    hostVisible: boolean;
    emailEnabled: boolean;
    pushEnabled: boolean;
    muted: boolean;
  }>();
  if (!service) return result;
  const { data } = await service
    .from("community_follows")
    .select("community_id, host_visible, email_enabled, push_enabled, muted_at")
    .eq("user_id", userId);
  for (const row of data ?? []) {
    result.set(String(row.community_id), {
      hostVisible: Boolean(row.host_visible),
      emailEnabled: Boolean(row.email_enabled),
      pushEnabled: Boolean(row.push_enabled),
      muted: Boolean(row.muted_at),
    });
  }
  return result;
}
