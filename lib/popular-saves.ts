import { formatCount } from "@/lib/overview/metrics";
import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE = 1000;

export type SaveKind = "listing" | "event" | "guide";

export type PopularSave = {
  kind: SaveKind;
  targetId: string;
  title: string;
  href: string | null;
  people: number;
  latest: string;
};

export type SavePerson = {
  userId: string;
  name: string;
  email: string | null;
  savedAt: string;
};

type SaveRow = { user_id: string; kind: string; target_id: string; created_at: string };

export function isSaveKind(value: string | undefined): value is SaveKind {
  return value === "listing" || value === "event" || value === "guide";
}

export function saveKindLabel(kind: SaveKind) {
  if (kind === "listing") return "Listing";
  if (kind === "event") return "Event";
  return "Guide";
}

export async function loadPopularSaves(input: {
  service: SupabaseClient | null;
  excludedOk: boolean;
  excluded: Set<string>;
  start: Date | null;
  end: Date | null;
}): Promise<{ state: "unavailable"; reason: string } | { state: "ready"; items: PopularSave[]; saves: number; capped: boolean }> {
  if (!input.service) return { state: "unavailable", reason: "The service role key is missing, so saves are withheld." };
  if (!input.excludedOk) return { state: "unavailable", reason: "Test accounts could not be listed, so saves are withheld." };

  const read = await readSaves(input.service, input.start, input.end);
  if (read.error) {
    return {
      state: "unavailable",
      reason: missingRelation(read.error) ? "Saves are not available yet." : "Saves could not be read.",
    };
  }

  const kept = read.rows.filter((row) => isSaveKind(row.kind) && !input.excluded.has(row.user_id));
  const grouped = new Map<string, PopularSave & { ids: Set<string> }>();
  for (const row of kept) {
    const kind = row.kind as SaveKind;
    const key = `${kind}:${row.target_id}`;
    const current = grouped.get(key) ?? {
      kind,
      targetId: row.target_id,
      title: "",
      href: null,
      people: 0,
      latest: row.created_at,
      ids: new Set<string>(),
    };
    current.ids.add(row.user_id);
    if (row.created_at > current.latest) current.latest = row.created_at;
    grouped.set(key, current);
  }

  const names = await loadTitles(input.service, [...grouped.values()]);
  if (names.error) return { state: "unavailable", reason: "Saved items could not be named." };

  const items = [...grouped.values()]
    .map((row) => {
      const named = names.titles.get(`${row.kind}:${row.targetId}`);
      return {
        kind: row.kind,
        targetId: row.targetId,
        title: named?.title || `Removed ${saveKindLabel(row.kind).toLowerCase()}`,
        href: named?.href ?? null,
        people: row.ids.size,
        latest: row.latest,
      };
    })
    .sort((a, b) => b.people - a.people || b.latest.localeCompare(a.latest) || a.title.localeCompare(b.title));

  return { state: "ready", items, saves: kept.length, capped: read.capped };
}

export async function loadSavePeople(input: {
  service: SupabaseClient | null;
  excludedOk: boolean;
  excluded: Set<string>;
  start: Date | null;
  end: Date | null;
  kind: SaveKind;
  targetId: string;
}): Promise<{ state: "unavailable"; reason: string } | { state: "ready"; title: string; href: string | null; people: SavePerson[] }> {
  const ranked = await loadPopularSaves(input);
  if (ranked.state === "unavailable") return ranked;
  const item = ranked.items.find((row) => row.kind === input.kind && row.targetId === input.targetId);
  if (!input.service) return { state: "unavailable", reason: "The service role key is missing, so saves are withheld." };

  const read = await readSaves(input.service, input.start, input.end);
  if (read.error) return { state: "unavailable", reason: "Saves could not be read." };
  const rows = read.rows.filter(
    (row) => row.kind === input.kind && row.target_id === input.targetId && !input.excluded.has(row.user_id),
  );
  const userIds = [...new Set(rows.map((row) => row.user_id))];
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
    title: item?.title || `Removed ${saveKindLabel(input.kind).toLowerCase()}`,
    href: item?.href ?? null,
    people: rows
      .map((row) => ({
        userId: row.user_id,
        name: names.get(row.user_id) || "Signed-in member",
        email: emails.get(row.user_id) ?? null,
        savedAt: row.created_at,
      }))
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
  };
}

export function popularSavesSummary(
  result: Awaited<ReturnType<typeof loadPopularSaves>>,
  period: string,
) {
  if (result.state === "unavailable") return result.reason;
  if (!result.items.length) return `No saves in ${period}. A save stays on this list while the member keeps it.`;
  const lines = result.items
    .slice(0, 3)
    .map((row) => `${row.title} · ${formatCount(row.people)} ${row.people === 1 ? "person" : "people"}`)
    .join(". ");
  return `${lines}. Counted in ${period}.`;
}

async function readSaves(service: SupabaseClient, start: Date | null, end: Date | null) {
  const rows: SaveRow[] = [];
  for (let from = 0; from < 20_000; from += PAGE) {
    let query = service
      .from("member_saves")
      .select("user_id, kind, target_id, created_at")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (start) query = query.gte("created_at", start.toISOString());
    if (end) query = query.lte("created_at", end.toISOString());
    const { data, error } = await query;
    if (error) return { error, rows, capped: false };
    const page = (data ?? []) as SaveRow[];
    rows.push(...page);
    if (page.length < PAGE) return { error: null, rows, capped: false };
  }
  return { error: null, rows, capped: true };
}

async function loadTitles(service: SupabaseClient, items: { kind: SaveKind; targetId: string }[]) {
  const titles = new Map<string, { title: string; href: string | null }>();
  const listings = items.filter((row) => row.kind === "listing").map((row) => row.targetId);
  const events = items.filter((row) => row.kind === "event").map((row) => row.targetId);
  const guides = items.filter((row) => row.kind === "guide").map((row) => row.targetId);
  const [listingRows, eventRows, guideRows] = await Promise.all([
    readNames(service, "directory_listings", "name", "/directory", listings),
    readNames(service, "events", "title", "/events", events),
    readNames(service, "curated_guides", "title", "/guides", guides),
  ]);
  const error = listingRows.error || eventRows.error || guideRows.error;
  if (error) return { error, titles };
  for (const [id, value] of listingRows.titles) titles.set(`listing:${id}`, value);
  for (const [id, value] of eventRows.titles) titles.set(`event:${id}`, value);
  for (const [id, value] of guideRows.titles) titles.set(`guide:${id}`, value);
  return { error: null, titles };
}

async function readNames(service: SupabaseClient, table: string, label: "name" | "title", path: string, ids: string[]) {
  const titles = new Map<string, { title: string; href: string | null }>();
  for (let from = 0; from < ids.length; from += 100) {
    const chunk = ids.slice(from, from + 100);
    if (!chunk.length) break;
    const { data, error } = await service.from(table).select(`id, ${label}, slug`).in("id", chunk);
    if (error) return { error, titles };
    for (const row of data ?? []) {
      const record = row as { id: string; slug?: string | null; name?: string | null; title?: string | null };
      const name = (label === "name" ? record.name : record.title)?.trim();
      titles.set(record.id, {
        title: name || "Untitled",
        href: record.slug ? `${path}/${record.slug}` : null,
      });
    }
  }
  return { error: null, titles };
}

function missingRelation(error: { message?: string }) {
  return /does not exist|schema cache|Could not find the/i.test(error.message ?? "");
}
