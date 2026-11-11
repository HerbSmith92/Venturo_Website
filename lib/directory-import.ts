import "server-only";

import { listingStatusLabel } from "@/lib/control-room-shared";
import {
  classifyDirectoryRows,
  DIRECTORY_CSV_COLUMNS,
  directoryMatchKey,
  emptyDirectoryRow,
  foldDirectoryText,
  parseDirectoryCsv,
  type DirectoryCsvRow,
} from "@/lib/directory-csv";
import { draftToPayload, emptyHours, INTEREST_CHIPS, type ListingDraft } from "@/lib/listing-draft";
import { createServiceClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";

type StaffClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

type KindRow = { id: string; key: string; title: string };

type MatchSource = {
  name: string | null;
  suburb: string | null;
  city: string | null;
  status: string | null;
  is_suspended: boolean | null;
  review_note: string | null;
  publish_at: string | null;
};

const LISTING_FIELDS =
  "id, name, branch_name, short_description, description, phone, email, website_url, booking_url, street_address_1, street_address_2, suburb, city, province, postal_code, status, is_suspended, review_note, publish_at, businesses ( name ), listing_activity_kinds ( is_primary, activity_kinds ( key ) )";

const MATCH_FIELDS = "name, suburb, city, status, is_suspended, review_note, publish_at";

export function directoryRowToDraft(row: DirectoryCsvRow, kindId: string | null): ListingDraft {
  return {
    name: row.name.trim(),
    branch_name: row.branch_name.trim(),
    short_description: row.short_description.trim(),
    description: row.description.trim(),
    phone: row.phone.trim(),
    email: row.email.trim(),
    website_url: row.website_url.trim(),
    booking_url: row.booking_url.trim(),
    street_address_1: row.street_address_1.trim(),
    street_address_2: row.street_address_2.trim(),
    suburb: row.suburb.trim(),
    city: row.city.trim(),
    province: row.province.trim(),
    postal_code: row.postal_code.trim(),
    latitude: "",
    longitude: "",
    maps_url: "",
    booking_required: false,
    indoor_outdoor: "",
    business_name: row.business_name.trim(),
    business_description: "",
    business_website: row.website_url.trim(),
    hours: emptyHours(),
    activities: [],
    media: [],
    social: [],
    persona_ids: [],
    interest_ids: [],
    interest_keywords: "",
    persona_keywords: "",
    scale_id: "",
    kind_ids: kindId ? [kindId] : [],
    cover_media_id: "",
    authorised_to_submit: false,
    image_rights_granted: false,
    terms_accepted: false,
  };
}

export async function loadDirectoryExportRows(supabase: StaffClient) {
  const rows = await eachPage<Record<string, unknown>>((from, to) =>
    supabase.from("directory_listings").select(LISTING_FIELDS).order("id").range(from, to),
  );
  return rows
    .map((row) => ({
      id: text(row.id),
      status: exportStatus(row),
      name: text(row.name),
      business_name: text(asRecord(row.businesses)?.name),
      branch_name: text(row.branch_name),
      short_description: text(row.short_description),
      description: text(row.description),
      phone: text(row.phone),
      email: text(row.email),
      website_url: text(row.website_url),
      booking_url: text(row.booking_url),
      street_address_1: text(row.street_address_1),
      street_address_2: text(row.street_address_2),
      suburb: text(row.suburb),
      city: text(row.city),
      province: text(row.province),
      postal_code: text(row.postal_code),
      interest: primaryKindKey(row.listing_activity_kinds),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "en-ZA") || a.id.localeCompare(b.id));
}

export async function previewDirectoryCsv(supabase: StaffClient, csv: string) {
  const parsed = parseDirectoryCsv(csv);
  if ("error" in parsed) return { ok: false as const, error: parsed.error };

  const [taken, kinds] = await Promise.all([loadMatchKeys(supabase), loadKinds(supabase)]);
  const prepared = parsed.rows.map((entry) => {
    const interest = kindFor(entry.row.interest, kinds);
    return {
      line: entry.line,
      row: entry.row,
      note: interest.unknown
        ? `Interest "${entry.row.interest.trim()}" is not a known activity kind, so it will be left blank.`
        : undefined,
    };
  });
  const { lines, fresh } = classifyDirectoryRows(prepared, taken);
  return { ok: true as const, lines, newRows: fresh };
}

export async function commitDirectoryRows(supabase: StaffClient, rows: DirectoryCsvRow[], actorId: string) {
  const clean = rows.map(cleanRow).filter((row) => DIRECTORY_CSV_COLUMNS.some((column) => row[column] !== ""));
  if (clean.length === 0) return { ok: true as const, created: 0 };
  if (clean.length > 400) {
    return { ok: false as const, created: 0, error: "Import up to 400 rows at a time." };
  }

  const [taken, kinds] = await Promise.all([loadMatchKeys(supabase), loadKinds(supabase)]);
  const prepared = clean.map((row, index) => ({
    line: index + 2,
    row,
    kindId: kindFor(row.interest, kinds).id,
  }));
  const { fresh } = classifyDirectoryRows(prepared, taken);
  const kindByRow = new Map(prepared.map((entry) => [entry.row, entry.kindId]));

  let created = 0;
  for (const row of fresh) {
    const createdRpc = await supabase.rpc("admin_create_listing");
    if (createdRpc.error) {
      return { ok: false as const, created, error: createdRpc.error.message };
    }
    const id = rpcId(createdRpc.data);
    if (!id) return { ok: false as const, created, error: "The new draft did not come back." };

    const saved = await supabase.rpc("admin_save_listing_draft", {
      p_listing_id: id,
      p_payload: draftToPayload(directoryRowToDraft(row, kindByRow.get(row) ?? null)),
    });
    created += 1;
    if (saved.error) {
      return {
        ok: false as const,
        created,
        error: `A draft was created for ${row.name}, but the details did not save. ${saved.error.message}`,
      };
    }
    const parked = await parkImportedDraft(id, actorId);
    if (parked) {
      return {
        ok: false as const,
        created,
        error: `${row.name} was saved, but it could not be kept as a draft. ${parked}`,
      };
    }
  }

  return { ok: true as const, created };
}

/** New listings open in review. Import keeps them as drafts, with no review note. */
async function parkImportedDraft(listingId: string, actorId: string) {
  const service = createServiceClient();
  if (!service) return "The directory service is not connected.";
  const { error } = await service
    .from("directory_listings")
    .update({ status: "draft", review_note: null })
    .eq("id", listingId);
  if (error) return error.message;
  await service.from("listing_audit_events").insert({
    listing_id: listingId,
    actor_id: actorId,
    action: "import-draft",
    from_status: "review",
    to_status: "draft",
  });
  return null;
}

function cleanRow(value: DirectoryCsvRow): DirectoryCsvRow {
  const row = emptyDirectoryRow();
  for (const column of DIRECTORY_CSV_COLUMNS) {
    const raw = value?.[column];
    row[column] = typeof raw === "string" ? raw.trim().slice(0, 8000) : "";
  }
  return row;
}

async function loadMatchKeys(supabase: StaffClient) {
  const rows = await eachPage<MatchSource>((from, to) =>
    supabase.from("directory_listings").select(MATCH_FIELDS).order("id").range(from, to),
  );
  const taken = new Map<string, string>();
  for (const row of rows) {
    const name = text(row.name);
    if (!name) continue;
    const key = directoryMatchKey(name, text(row.suburb), text(row.city));
    if (!taken.has(key)) taken.set(key, statusLabel(row));
  }
  return taken;
}

async function loadKinds(supabase: StaffClient): Promise<KindRow[]> {
  const { data, error } = await supabase.from("activity_kinds").select("id, key, title");
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((row) => {
    const id = text(row.id);
    const key = text(row.key);
    if (!id || !key) return [];
    return [{ id, key, title: text(row.title) }];
  });
}

function kindFor(interest: string, kinds: KindRow[]) {
  const needle = foldDirectoryText(interest);
  if (!needle) return { id: null as string | null, unknown: false };
  const chip = INTEREST_CHIPS.find(
    (item) => foldDirectoryText(item.key) === needle || foldDirectoryText(item.label) === needle,
  );
  const wanted = foldDirectoryText(chip?.key ?? needle);
  const found = kinds.find(
    (item) => foldDirectoryText(item.key) === wanted || foldDirectoryText(item.title) === needle,
  );
  if (!found) return { id: null, unknown: true };
  return { id: found.id, unknown: false };
}

function statusLabel(row: MatchSource) {
  const scheduled =
    row.status === "approved" &&
    !row.is_suspended &&
    Boolean(row.publish_at) &&
    Date.parse(row.publish_at ?? "") > Date.now();
  return listingStatusLabel(row.status ?? "draft", {
    suspended: Boolean(row.is_suspended),
    scheduled,
    changes: row.status === "draft" && Boolean(row.review_note?.trim()),
  });
}

function exportStatus(row: Record<string, unknown>) {
  return statusLabel({
    name: null,
    suburb: null,
    city: null,
    status: text(row.status) || null,
    is_suspended: Boolean(row.is_suspended),
    review_note: text(row.review_note) || null,
    publish_at: text(row.publish_at) || null,
  });
}

function primaryKindKey(value: unknown) {
  if (!Array.isArray(value)) return "";
  const links = [...value].sort(
    (a, b) => Number(Boolean(record(b)?.is_primary)) - Number(Boolean(record(a)?.is_primary)),
  );
  const kind = asRecord(record(links[0])?.activity_kinds);
  return text(kind?.key);
}

function rpcId(data: unknown) {
  const row = Array.isArray(data) ? data[0] : data;
  const id = record(row)?.id;
  return typeof id === "string" ? id : null;
}

async function eachPage<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  const pageSize = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    all.push(...batch);
    if (batch.length < pageSize) break;
  }
  return all;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  const row = Array.isArray(value) ? value[0] : value;
  return record(row);
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}
