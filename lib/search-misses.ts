import { CATEGORIES, categoryLabel, searchDirectory, type CategoryId, type DirectoryQuery } from "@/lib/listings";
import type { ActivityPlatform } from "@/lib/member-activity";
import {
  formatCount,
  johannesburgDateKey,
  type PlatformFilter,
} from "@/lib/overview/metrics";
import { createServiceClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const VISITOR_COOKIE = "venturo_vid";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SearchMissRow = {
  id: string;
  searchedAt: string;
  userId: string | null;
  platform: string;
  query: string;
  place: string;
  category: string;
  maxPrice: string;
  nearMe: boolean;
  name: string | null;
  email: string | null;
};

export function clipSearchText(value: string | undefined, max = 160) {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

export function directoryCategory(value: string | undefined) {
  const id = clipSearchText(value, 40);
  if (!id || id === "all") return "";
  return CATEGORIES.some((item) => item.id === id) ? id : "";
}

export function directoryPrice(value: string | undefined) {
  const price = clipSearchText(value, 12);
  const amount = Number(price);
  if (!price || !Number.isFinite(amount) || amount <= 0) return "";
  return price;
}

export function directoryNearMe(lat: string | undefined, lng: string | undefined) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

export function isDirectorySearch(query: DirectoryQuery) {
  return Boolean(
    clipSearchText(query.q) ||
      clipSearchText(query.place) ||
      directoryPrice(query.price) ||
      directoryCategory(query.category) ||
      directoryNearMe(query.lat, query.lng),
  );
}

export function describeSearch(row: {
  query: string;
  place: string;
  category: string;
  maxPrice: string;
  nearMe: boolean;
}) {
  const parts: string[] = [];
  if (row.query) parts.push(row.query);
  if (row.place) parts.push(`in ${row.place}`);
  if (row.category) parts.push(categoryLabel(row.category as CategoryId));
  if (row.maxPrice) parts.push(`up to R ${row.maxPrice}`);
  if (row.nearMe) parts.push("near their location");
  return parts.join(" · ") || "Directory search";
}

export function visitorKeyFromCookie(value: string | undefined) {
  if (!value || !UUID.test(value)) return null;
  return value;
}

export { VISITOR_COOKIE };

export async function loadExcludedIds(service: SupabaseClient | null) {
  if (!service) return { ok: false, ids: new Set<string>() };
  const { data, error } = await service.rpc("metrics_excluded_user_ids");
  if (error || !Array.isArray(data)) return { ok: false, ids: new Set<string>() };
  return { ok: true, ids: new Set(data.filter((id): id is string => typeof id === "string")) };
}

function queryKey(input: { query: string; place: string; category: string; maxPrice: string; nearMe: boolean }) {
  return [input.query, input.place, input.category, input.maxPrice, input.nearMe ? "near" : ""].join("|").toLowerCase();
}

const SEARCHES = "directory_searches";

/** Records one directory search. A repeat by the same person on the same day is kept once. */
export async function recordDirectorySearch(input: {
  userId: string | null;
  visitorKey: string | null;
  platform: ActivityPlatform;
  query: DirectoryQuery;
  resultCount: number;
}) {
  if (!isDirectorySearch(input.query)) return;
  const service = createServiceClient();
  if (!service) return;

  const fields = {
    query: clipSearchText(input.query.q),
    place: clipSearchText(input.query.place),
    category: directoryCategory(input.query.category),
    maxPrice: directoryPrice(input.query.price),
    nearMe: directoryNearMe(input.query.lat, input.query.lng),
  };
  const now = new Date();
  const day = johannesburgDateKey(now);
  const key = queryKey(fields);
  const userId = input.userId;
  const visitorKey = userId ? null : input.visitorKey;

  let existing = service
    .from(SEARCHES)
    .select("id")
    .eq("day", day)
    .eq("platform", input.platform)
    .eq("query_key", key);
  existing = userId ? existing.eq("user_id", userId) : visitorKey ? existing.eq("visitor_key", visitorKey).is("user_id", null) : existing;
  if (userId || visitorKey) {
    const { data, error } = await existing.limit(1);
    if (error && !missingRelation(error)) console.error("recordDirectorySearch", error.message);
    if (error || (data && data.length > 0)) return;
  }

  const resultCount = Number.isFinite(input.resultCount) ? Math.max(0, Math.floor(input.resultCount)) : 0;
  const { error } = await service.from(SEARCHES).insert({
    searched_at: now.toISOString(),
    day,
    user_id: userId,
    visitor_key: visitorKey,
    platform: input.platform,
    query: fields.query,
    place: fields.place,
    category: fields.category,
    max_price: fields.maxPrice,
    near_me: fields.nearMe,
    query_key: key,
    result_count: resultCount,
  });
  if (error && error.code !== "23505" && !missingRelation(error)) {
    console.error("recordDirectorySearch", error.message);
  }
}

export async function directoryResultCount(query: DirectoryQuery) {
  if (!isDirectorySearch(query)) return null;
  const listings = await searchDirectory(query);
  return listings.length;
}

type MissFilter = {
  service: SupabaseClient;
  excluded: Set<string>;
  start: Date | null;
  end: Date | null;
  platform: PlatformFilter;
  resultCount?: number | null;
  queryKey?: string | null;
};

function applyMissFilters<Q extends { gte: Function; lte: Function; eq: Function; or: Function }>(query: Q, input: MissFilter) {
  let next = query;
  if (input.start) next = next.gte("searched_at", input.start.toISOString()) as Q;
  if (input.end) next = next.lte("searched_at", input.end.toISOString()) as Q;
  if (input.platform !== "all") next = next.eq("platform", input.platform) as Q;
  if (typeof input.resultCount === "number") next = next.eq("result_count", input.resultCount) as Q;
  if (input.queryKey) next = next.eq("query_key", input.queryKey) as Q;
  const ids = [...input.excluded];
  if (ids.length) next = next.or(`user_id.is.null,user_id.not.in.(${ids.join(",")})`) as Q;
  return next;
}

export async function loadSearchMisses(input: {
  service: SupabaseClient | null;
  excludedOk: boolean;
  excluded: Set<string>;
  start: Date | null;
  end: Date | null;
  platform: PlatformFilter;
  queryKey?: string | null;
}): Promise<
  | { state: "unavailable"; reason: string }
  | { state: "ready"; total: number; signedIn: number; rows: SearchMissRow[]; capped: boolean }
> {
  if (!input.service) {
    return { state: "unavailable", reason: "The service role key is missing, so search history is withheld." };
  }
  if (!input.excludedOk) {
    return { state: "unavailable", reason: "Test accounts could not be listed, so search history is withheld." };
  }

  const filter = { ...input, service: input.service, resultCount: 0 as const };
  const totalQuery = applyMissFilters(
    input.service.from(SEARCHES).select("id", { count: "exact", head: true }),
    filter,
  );
  const signedQuery = applyMissFilters(
    input.service.from(SEARCHES).select("id", { count: "exact", head: true }).not("user_id", "is", null),
    filter,
  );
  const listQuery = applyMissFilters(
    input.service
      .from(SEARCHES)
      .select("id, searched_at, user_id, platform, query, place, category, max_price, near_me")
      .order("searched_at", { ascending: false })
      .limit(200),
    filter,
  );

  const [total, signed, list] = await Promise.all([totalQuery, signedQuery, listQuery]);
  const error = total.error || signed.error || list.error;
  if (error) {
    return {
      state: "unavailable",
      reason: missingRelation(error) ? "Search history is not available yet." : "Search history could not be read.",
    };
  }

  const raw = (list.data ?? []) as {
    id: string;
    searched_at: string;
    user_id: string | null;
    platform: string;
    query: string;
    place: string;
    category: string;
    max_price: string;
    near_me: boolean;
  }[];
  const userIds = [...new Set(raw.map((row) => row.user_id).filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  const emails = new Map<string, string>();
  if (userIds.length) {
    const [profiles, contacts] = await Promise.all([
      input.service.from("profiles").select("id, display_name, last_name").in("id", userIds),
      input.service.rpc("search_miss_contacts", { ids: userIds }),
    ]);
    for (const row of profiles.data ?? []) {
      const name = [row.display_name, row.last_name]
        .map((part) => (typeof part === "string" ? part.trim() : ""))
        .filter(Boolean)
        .join(" ");
      if (name) names.set(row.id as string, name);
    }
    if (Array.isArray(contacts.data)) {
      for (const row of contacts.data as { id?: string; email?: string | null }[]) {
        if (row.id && row.email) emails.set(row.id, row.email);
      }
    }
  }

  return {
    state: "ready",
    total: total.count ?? 0,
    signedIn: signed.count ?? 0,
    capped: (total.count ?? 0) > raw.length,
    rows: raw.map((row) => ({
      id: row.id,
      searchedAt: row.searched_at,
      userId: row.user_id,
      platform: row.platform,
      query: row.query,
      place: row.place,
      category: row.category,
      maxPrice: row.max_price,
      nearMe: row.near_me,
      name: row.user_id ? names.get(row.user_id) ?? null : null,
      email: row.user_id ? emails.get(row.user_id) ?? null : null,
    })),
  };
}

export function searchMissSummary(result: Awaited<ReturnType<typeof loadSearchMisses>>, period: string) {
  if (result.state === "unavailable") return result.reason;
  if (result.total === 0) {
    return `No empty searches in ${period}. A signed-in search is kept so that person can be contacted when the place is added.`;
  }
  return `${formatCount(result.total)} searches came back empty in ${period}. ${formatCount(result.signedIn)} were signed in, so they can be contacted when that place is added.`;
}

export type PopularSearch = {
  queryKey: string;
  query: string;
  place: string;
  category: string;
  maxPrice: string;
  nearMe: boolean;
  times: number;
  people: number;
  empty: number;
};

export async function loadPopularSearches(input: {
  service: SupabaseClient | null;
  excludedOk: boolean;
  excluded: Set<string>;
  start: Date | null;
  end: Date | null;
  platform: PlatformFilter;
}): Promise<
  | { state: "unavailable"; reason: string }
  | { state: "ready"; searches: number; terms: PopularSearch[]; capped: boolean }
> {
  if (!input.service) {
    return { state: "unavailable", reason: "The service role key is missing, so search history is withheld." };
  }
  if (!input.excludedOk) {
    return { state: "unavailable", reason: "Test accounts could not be listed, so search history is withheld." };
  }

  const filter = { ...input, service: input.service };
  const pageSize = 1000;
  const raw: {
    query_key: string;
    query: string;
    place: string;
    category: string;
    max_price: string;
    near_me: boolean;
    result_count: number;
    user_id: string | null;
  }[] = [];
  for (let from = 0; from < 20_000; from += pageSize) {
    const { data, error } = await applyMissFilters(
      input.service
        .from(SEARCHES)
        .select("query_key, query, place, category, max_price, near_me, result_count, user_id")
        .order("searched_at", { ascending: false })
        .range(from, from + pageSize - 1),
      filter,
    );
    if (error) {
      return {
        state: "unavailable",
        reason: missingRelation(error) ? "Search history is not available yet." : "Search history could not be read.",
      };
    }
    const page = (data ?? []) as typeof raw;
    raw.push(...page);
    if (page.length < pageSize) break;
  }

  const grouped = new Map<string, PopularSearch & { peopleIds: Set<string> }>();
  for (const row of raw) {
    const current = grouped.get(row.query_key) ?? {
      queryKey: row.query_key,
      query: row.query,
      place: row.place,
      category: row.category,
      maxPrice: row.max_price,
      nearMe: row.near_me,
      times: 0,
      people: 0,
      empty: 0,
      peopleIds: new Set<string>(),
    };
    current.times += 1;
    if ((row.result_count ?? 0) === 0) current.empty += 1;
    if (row.user_id) current.peopleIds.add(row.user_id);
    grouped.set(row.query_key, current);
  }

  const terms = [...grouped.values()]
    .map((row) => ({
      queryKey: row.queryKey,
      query: row.query,
      place: row.place,
      category: row.category,
      maxPrice: row.maxPrice,
      nearMe: row.nearMe,
      times: row.times,
      people: row.peopleIds.size,
      empty: row.empty,
    }))
    .sort((a, b) => b.times - a.times || describeSearch(a).localeCompare(describeSearch(b)));

  return {
    state: "ready",
    searches: raw.length,
    terms,
    capped: raw.length >= 20_000,
  };
}

export function searchPopularSummary(result: Awaited<ReturnType<typeof loadPopularSearches>>, period: string) {
  if (result.state === "unavailable") return result.reason;
  if (result.searches === 0) {
    return `No directory searches in ${period}. Each search is kept, and the same person counts once a day.`;
  }
  const top = result.terms
    .slice(0, 3)
    .map((row) => `${describeSearch(row)} (${formatCount(row.times)})`)
    .join(" · ");
  return `${formatCount(result.searches)} searches in ${period}. Most searched: ${top}. The same person counts once a day.`;
}

function missingRelation(error: { message?: string } | null) {
  return /does not exist|schema cache|Could not find the/i.test(error?.message ?? "");
}
