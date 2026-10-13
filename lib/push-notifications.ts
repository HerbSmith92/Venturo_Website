import { createServiceClient } from "@/lib/supabase/admin";

export const PUSH_AUDIENCES = ["everyone", "paid", "free", "hosts"] as const;
export const PUSH_APPS = ["companion", "member", "both"] as const;

export type PushAudience = (typeof PUSH_AUDIENCES)[number];
export type PushApp = (typeof PUSH_APPS)[number];

export type PushCampaign = {
  id: string;
  title: string;
  body: string;
  audience: PushAudience;
  app: PushApp;
  link_path: string | null;
  place_label: string | null;
  opens_label: string | null;
  notice_kind: PushNotice | null;
  status: "sent" | "failed";
  device_count: number;
  inbox_count: number;
  opened_count: number;
  pushed_count: number;
  failed_count: number;
  error: string | null;
  created_at: string;
};

export type PushDeviceStats = {
  phones: number;
  pushReady: number;
  reached: number;
  opened: number;
};

export type PushDraft = {
  title: string;
  body: string;
  audience: PushAudience;
  app: PushApp;
  opens: string;
  place: string;
  notice: PushNotice;
  target: string;
};

export type PushOpenOption = {
  kind: "guide" | "event";
  id: string;
  title: string;
  detail: string | null;
};

export const PUSH_NOTICES = ["custom", "remind", "community", "interest", "weekend", "saved"] as const;

export type PushNotice = (typeof PUSH_NOTICES)[number];

export type PushTargetOption = {
  id: string;
  title: string;
};

export type PushPlaceOption = {
  id: string;
  name: string;
  region: string;
};

export type PushSendResult =
  | { error: string }
  | { inbox: number; pushed: number; failed: number; phones: number };

/** Home areas inside this distance of the chosen place are included. Centurion is about 41 km from Johannesburg, so 32 km keeps Pretoria & Centurion out. */
export const PLACE_REACH_KM = 32;

const LINK_PATH = /^\/[A-Za-z0-9][A-Za-z0-9/_-]{0,199}$/;
const OPENS = /^(guide|event):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLACE_ID = /^place:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TARGET_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGION = /^region:[A-Za-z][A-Za-z -]{0,40}$/;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export function pushAudienceLabel(audience: PushAudience) {
  if (audience === "everyone") return "Everyone with the app";
  if (audience === "paid") return "Paid members";
  if (audience === "free") return "Free members";
  return "Event hosts";
}

export function pushNoticeLabel(notice: string | null) {
  if (notice === "remind") return "App reminder";
  if (notice === "community") return "Community event";
  if (notice === "interest") return "Interest";
  if (notice === "weekend") return "This weekend";
  if (notice === "saved") return "Favourites";
  return "Custom";
}

export function parsePushDraft(input: {
  title: string;
  body: string;
  audience: string;
  opens: string;
  place: string;
  notice: string;
  target: string;
}): { error: string } | { draft: PushDraft } {
  const title = input.title.trim();
  const body = input.body.trim();
  const opens = input.notice === "custom" ? input.opens.trim() : "";
  const place = input.place.trim();
  const notice = input.notice.trim() || "custom";
  const target = input.target.trim();

  if (!title) return { error: "Add a title." as const };
  if (title.length > 80) return { error: "Title must be 80 characters or fewer." as const };
  if (!body) return { error: "Add a message." as const };
  if (body.length > 240) return { error: "Message must be 240 characters or fewer." as const };
  if (!isAudience(input.audience)) return { error: "Choose who should receive this." as const };
  if (opens && !OPENS.test(opens)) return { error: "Choose a guide or event to open." as const };
  if (!isNotice(notice)) return { error: "Choose the kind of notification." as const };
  if ((notice === "community" || notice === "interest") && !TARGET_ID.test(target)) {
    return { error: notice === "community" ? "Choose a community." as const : "Choose an interest." as const };
  }
  if (!place) return { error: "Choose where this should arrive." as const };
  if (place !== "everywhere" && !PLACE_ID.test(place) && !REGION.test(place)) {
    return { error: "Choose a place, a region, or Everywhere." as const };
  }

  return {
    draft: {
      title,
      body,
      audience: input.audience,
      app: "member",
      opens,
      place,
      notice,
      target: notice === "community" || notice === "interest" ? target : "",
    } satisfies PushDraft,
  };
}

export async function loadPushDesk() {
  const service = createServiceClient();
  if (!service) {
    return { serviceRoleReady: false as const, stats: emptyStats(), campaigns: [] as PushCampaign[], loadError: null };
  }

  const [phones, pushReady, campaigns] = await Promise.all([
    countDevices(service, false),
    countDevices(service, true),
    service
      .from("push_campaigns")
      .select(
        "id, title, body, audience, app, link_path, place_label, opens_label, notice_kind, status, device_count, inbox_count, pushed_count, failed_count, error, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const rows = (campaigns.data ?? []) as Omit<PushCampaign, "opened_count">[];
  const opens = await countOpens(
    service,
    rows.map((campaign) => campaign.id),
  );
  const withOpens = rows.map((campaign) => ({
    ...campaign,
    opened_count: opens.counts.get(campaign.id) ?? 0,
  }));
  const missing = [phones.error, pushReady.error, campaigns.error, opens.error].find((error) => error);

  return {
    serviceRoleReady: true as const,
    stats: {
      phones: phones.count ?? 0,
      pushReady: pushReady.count ?? 0,
      reached: withOpens.reduce((sum, campaign) => sum + campaign.inbox_count, 0),
      opened: withOpens.reduce((sum, campaign) => sum + campaign.opened_count, 0),
    },
    campaigns: withOpens,
    loadError: missing ? missing.message : null,
  };
}

export async function deliverPushCampaign(draft: PushDraft, createdBy: string): Promise<PushSendResult> {
  const service = createServiceClient();
  if (!service) {
    return { error: "Add SUPABASE_SERVICE_ROLE_KEY before sending." };
  }

  const destination = await resolveDestination(service, draft);
  if ("error" in destination) return destination;

  const devices = await loadDevices(service);
  if (devices.error) return { error: devices.error };

  const matchedAudience = await filterAudience(service, devices.rows, draft.audience);
  if (matchedAudience.error) return { error: matchedAudience.error };
  const matchedPlace = await filterPlace(service, matchedAudience.rows, destination.place);
  if (matchedPlace.error) return { error: matchedPlace.error };
  const matchedNotice = await filterNotice(service, matchedPlace.rows, draft);
  if (matchedNotice.error) return { error: matchedNotice.error };
  const matched = matchedNotice.rows;
  if (matched.length === 0) {
    return { error: emptyMatchMessage(draft, destination.place) };
  }

  const { data: campaign, error: insertError } = await service
    .from("push_campaigns")
    .insert({
      title: draft.title,
      body: draft.body,
      audience: draft.audience,
      app: "member",
      link_path: destination.linkPath,
      place_id: destination.place.id,
      place_label:
        destination.place.kind === "everywhere"
          ? "Everywhere"
          : destination.place.kind === "region"
            ? destination.place.label
            : `${destination.place.label} · ${PLACE_REACH_KM} km`,
      opens_kind: destination.opens?.kind ?? null,
      opens_id: destination.opens?.id ?? null,
      opens_label: destination.opens?.label ?? destination.label,
      notice_kind: draft.notice,
      status: "sent",
      created_by: createdBy,
      device_count: matched.length,
    })
    .select("id")
    .single();

  if (insertError || !campaign) {
    return { error: insertError?.message ?? "Could not save that notification." };
  }

  const users = uniqueUsers(matched);
  const inbox = users.map((userId) => ({
    campaign_id: campaign.id,
    user_id: userId,
    title: draft.title,
    body: draft.body,
    link_path: destination.linkPath,
  }));

  let inboxCount = 0;
  for (const batch of chunks(inbox, 500)) {
    const inserted = await service.from("push_inbox").insert(batch).select("id");
    if (inserted.error) {
      await service
        .from("push_campaigns")
        .update({ status: "failed", error: inserted.error.message, inbox_count: inboxCount })
        .eq("id", campaign.id);
      return { error: inserted.error.message };
    }
    inboxCount += inserted.data?.length ?? 0;
  }

  const push = await pushTokens(matched, {
    title: draft.title,
    body: draft.body,
    path: destination.linkPath,
    kind: destination.opens?.kind ?? destination.extraKind,
    id: destination.opens?.id ?? destination.extraId,
    slug: destination.opens?.slug ?? "",
    when: destination.when,
    campaignId: campaign.id,
  });

  if (push.dropTokenIds.length > 0) {
    await service.from("push_devices").update({ token: null }).in("id", push.dropTokenIds);
  }

  await service
    .from("push_campaigns")
    .update({
      inbox_count: inboxCount,
      pushed_count: push.pushed,
      failed_count: push.failed,
      error: push.error,
      status: push.error && push.pushed === 0 && push.attempted > 0 ? "failed" : "sent",
    })
    .eq("id", campaign.id);

  return {
    inbox: inboxCount,
    pushed: push.pushed,
    failed: push.failed,
    phones: matched.length,
  };
}

function emptyStats(): PushDeviceStats {
  return { phones: 0, pushReady: 0, reached: 0, opened: 0 };
}

async function countOpens(service: Service, campaignIds: string[]) {
  const counts = new Map<string, number>();
  if (campaignIds.length === 0) return { counts, error: null };

  for (let from = 0; ; from += 1000) {
    const { data, error } = await service
      .from("push_inbox")
      .select("campaign_id")
      .in("campaign_id", campaignIds)
      .not("opened_at", "is", null)
      .range(from, from + 999);
    if (error) return { counts, error };
    for (const row of data ?? []) {
      const id = row.campaign_id as string;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    if (!data || data.length < 1000) break;
  }

  return { counts, error: null };
}

function isAudience(value: string): value is PushAudience {
  return (PUSH_AUDIENCES as readonly string[]).includes(value);
}

function isNotice(value: string): value is PushNotice {
  return (PUSH_NOTICES as readonly string[]).includes(value);
}

type Service = NonNullable<ReturnType<typeof createServiceClient>>;

type DeviceRow = {
  id: string;
  user_id: string;
  token: string | null;
};

async function countDevices(service: Service, withToken: boolean) {
  let query = service.from("push_devices").select("id", { count: "exact", head: true }).eq("app", "member");
  if (withToken) query = query.not("token", "is", null);
  const { count, error } = await query;
  return { count, error };
}

async function loadDevices(service: Service) {
  const rows: DeviceRow[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const query = service
      .from("push_devices")
      .select("id, user_id, token")
      .eq("app", "member")
      .order("id")
      .range(from, from + pageSize - 1);
    const { data, error } = await query;
    if (error) return { error: error.message, rows: [] as DeviceRow[] };
    rows.push(...((data ?? []) as DeviceRow[]));
    if (!data || data.length < pageSize) break;
  }

  return { rows };
}

async function filterAudience(service: Service, rows: DeviceRow[], audience: PushAudience) {
  if (audience === "everyone") return { rows };
  const userIds = uniqueUsers(rows);
  const allowed = new Set<string>();

  try {
    for (const batch of chunks(userIds, 200)) {
      if (audience === "hosts") {
        const [events, collaborators] = await Promise.all([
          service.from("events").select("organiser_id").in("organiser_id", batch),
          service.from("event_collaborators").select("user_id").in("user_id", batch),
        ]);
        if (events.error) return { error: events.error.message, rows: [] as DeviceRow[] };
        if (collaborators.error) return { error: collaborators.error.message, rows: [] as DeviceRow[] };
        for (const row of events.data ?? []) {
          if (row.organiser_id) allowed.add(row.organiser_id as string);
        }
        for (const row of collaborators.data ?? []) {
          if (row.user_id) allowed.add(row.user_id as string);
        }
      } else {
        const access = await service.from("member_access").select("user_id, subscribed").in("user_id", batch);
        if (access.error) return { error: access.error.message, rows: [] as DeviceRow[] };
        for (const row of access.data ?? []) {
          const paid = Boolean(row.subscribed);
          if (audience === "paid" ? paid : !paid) allowed.add(row.user_id as string);
        }
        if (audience === "free") {
          const known = new Set((access.data ?? []).map((row) => row.user_id as string));
          for (const userId of batch) {
            if (!known.has(userId)) allowed.add(userId);
          }
        }
      }
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not match that audience.", rows: [] as DeviceRow[] };
  }

  return { rows: rows.filter((row) => allowed.has(row.user_id)) };
}

function uniqueUsers(rows: DeviceRow[]) {
  return [...new Set(rows.map((row) => row.user_id))];
}

type PlaceScope =
  | { kind: "everywhere"; id: null; label: "Everywhere" }
  | { kind: "place"; id: string; label: string }
  | { kind: "region"; id: null; label: string };

type ResolvedDestination = {
  linkPath: string | null;
  opens: { kind: "guide" | "event"; id: string; label: string; slug: string } | null;
  place: PlaceScope;
  label: string | null;
  extraKind: string;
  extraId: string;
  when: string;
};

async function resolveDestination(service: Service, draft: PushDraft): Promise<{ error: string } | ResolvedDestination> {
  const resolvedPlace = await resolvePlace(service, draft.place);
  if ("error" in resolvedPlace) return resolvedPlace;
  const place = resolvedPlace.place;

  if (draft.notice === "remind") {
    return { linkPath: null, opens: null, place, label: "The app", extraKind: "", extraId: "", when: "" };
  }
  if (draft.notice === "weekend") {
    return { linkPath: "/events", opens: null, place, label: "This weekend", extraKind: "weekend", extraId: "", when: "weekend" };
  }
  if (draft.notice === "saved") {
    return { linkPath: "/account/saved", opens: null, place, label: "Favourites", extraKind: "saved", extraId: "", when: "" };
  }
  if (draft.notice === "community") return resolveCommunityEvent(service, draft.target, place);
  if (draft.notice === "interest") return resolveInterest(service, draft.target, place);

  if (!draft.opens) {
    return { linkPath: null, opens: null, place, label: null, extraKind: "", extraId: "", when: "" };
  }

  const [kind, id] = draft.opens.split(":") as ["guide" | "event", string];
  if (kind === "guide") {
    const guide = await loadLiveGuide(service, id);
    if (!("path" in guide)) return guide;
    return { linkPath: guide.path, opens: guide.opens, place, label: guide.opens.label, extraKind: "", extraId: "", when: "" };
  }

  const event = await loadLiveEvent(service, id);
  if (!("path" in event)) return event;
  return { linkPath: event.path, opens: event.opens, place, label: event.opens.label, extraKind: "", extraId: "", when: "" };
}

async function resolveCommunityEvent(
  service: Service,
  communityId: string,
  place: PlaceScope,
): Promise<{ error: string } | ResolvedDestination> {
  const community = await service.from("communities").select("id, title, status").eq("id", communityId).maybeSingle();
  if (community.error) return { error: community.error.message };
  if (!community.data || community.data.status !== "published") return { error: "That community is not live." };

  const links = await service
    .from("community_events")
    .select("event_id")
    .eq("community_id", communityId)
    .eq("link_status", "approved");
  if (links.error) return { error: links.error.message };
  const eventIds = (links.data ?? []).map((row) => row.event_id as string);
  if (eventIds.length === 0) return { error: "That community does not have an event yet." };

  const events = await service
    .from("events")
    .select("id, title, slug, status, starts_at")
    .in("id", eventIds)
    .eq("status", "approved")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(1);
  if (events.error) return { error: events.error.message };
  const next = events.data?.[0];
  if (!next) return { error: "That community does not have an upcoming event." };

  const loaded = await loadLiveEvent(service, next.id as string);
  if (!("path" in loaded)) return loaded;
  return {
    linkPath: loaded.path,
    opens: loaded.opens,
    place,
    label: `${community.data.title as string} · ${loaded.opens.label}`,
    extraKind: "",
    extraId: "",
    when: "",
  };
}

async function resolveInterest(
  service: Service,
  interestId: string,
  place: PlaceScope,
): Promise<{ error: string } | ResolvedDestination> {
  const interest = await service.from("interests").select("id, title").eq("id", interestId).eq("is_active", true).maybeSingle();
  if (interest.error) return { error: interest.error.message };
  const title = interest.data?.title?.trim();
  if (!interest.data || !title) return { error: "Choose an interest that is still on the list." };

  const links = await service.from("curated_guide_interests").select("guide_id").eq("interest_id", interestId);
  if (links.error) return { error: links.error.message };
  for (const link of links.data ?? []) {
    const guide = await loadLiveGuide(service, link.guide_id as string);
    if (!("path" in guide)) continue;
    return { linkPath: guide.path, opens: guide.opens, place, label: title, extraKind: "", extraId: "", when: "" };
  }

  return { linkPath: "/guides", opens: null, place, label: title, extraKind: "interest", extraId: interestId, when: "" };
}

async function loadLiveGuide(
  service: Service,
  id: string,
): Promise<{ error: string } | { path: string; opens: { kind: "guide"; id: string; label: string; slug: string } }> {
  const { data, error } = await service
    .from("curated_guides")
    .select("id, title, slug, status, publish_at, expire_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data || data.status !== "published" || !guideIsOpen(data.publish_at, data.expire_at)) {
    return { error: "That guide is not live." };
  }
  const slug = String(data.slug ?? "");
  const path = `/guides/${slug}`;
  if (!slug || !LINK_PATH.test(path)) return { error: "That guide does not have a path the app can open." };
  return { path, opens: { kind: "guide" as const, id, label: String(data.title), slug } };
}

async function loadLiveEvent(
  service: Service,
  id: string,
): Promise<{ error: string } | { path: string; opens: { kind: "event"; id: string; label: string; slug: string } }> {
  const { data, error } = await service.from("events").select("id, title, slug, status").eq("id", id).maybeSingle();
  if (error) return { error: error.message };
  if (!data || data.status !== "approved") return { error: "That event is not live." };
  const slug = String(data.slug ?? "");
  const path = `/events/${slug}`;
  if (!slug || !LINK_PATH.test(path)) return { error: "That event does not have a path the app can open." };
  return { path, opens: { kind: "event" as const, id, label: String(data.title), slug } };
}

async function resolvePlace(service: Service, place: string): Promise<{ error: string } | { place: PlaceScope }> {
  if (place === "everywhere") return { place: { kind: "everywhere", id: null, label: "Everywhere" } };

  if (place.startsWith("place:")) {
    const id = place.slice("place:".length);
    const { data, error } = await service.from("places").select("id, name").eq("id", id).eq("is_active", true).maybeSingle();
    if (error) return { error: error.message };
    const name = data?.name?.trim();
    if (!data || !name) return { error: "Choose a place that is still on the list." };
    return { place: { kind: "place", id, label: name } };
  }

  const region = place.slice("region:".length).trim();
  const { count, error } = await service
    .from("places")
    .select("id", { count: "exact", head: true })
    .eq("region", region)
    .eq("is_active", true);
  if (error) return { error: error.message };
  if (!count) return { error: "Choose a region that is still on the list." };
  return { place: { kind: "region", id: null, label: region } };
}

async function filterPlace(service: Service, rows: DeviceRow[], place: PlaceScope) {
  if (place.kind === "everywhere") return { rows };
  const userIds = uniqueUsers(rows);
  const allowed = new Set<string>();
  let placeIds: Set<string> | null = null;

  if (place.kind === "region") {
    const { data, error } = await service.from("places").select("id").eq("region", place.label).eq("is_active", true);
    if (error) return { error: error.message, rows: [] as DeviceRow[] };
    placeIds = new Set((data ?? []).map((row) => row.id as string));
  } else {
    const nearby = await nearbyPlaceIds(service, place.id);
    if ("error" in nearby) return { error: nearby.error, rows: [] as DeviceRow[] };
    placeIds = nearby.ids;
  }

  for (const batch of chunks(userIds, 200)) {
    const profiles = await service.from("profiles").select("id, home_place_id").in("id", batch);
    if (profiles.error) return { error: profiles.error.message, rows: [] as DeviceRow[] };
    for (const profile of profiles.data ?? []) {
      const home = profile.home_place_id as string | null;
      if (!home) continue;
      if (placeIds?.has(home)) allowed.add(profile.id as string);
    }
  }

  return { rows: rows.filter((row) => allowed.has(row.user_id)) };
}

function emptyMatchMessage(draft: PushDraft, place: PlaceScope) {
  const where =
    place.kind === "everywhere"
      ? "anywhere"
      : place.kind === "region"
        ? `in ${place.label}`
        : `within ${PLACE_REACH_KM} km of ${place.label}`;
  if (draft.notice === "community") {
    return `No followers ${where} have the app. This only reaches people who follow that community.`;
  }
  if (draft.notice === "interest") {
    return `No one ${where} has that interest on their profile.`;
  }
  if (draft.notice === "saved") {
    return `No one ${where} has favourited a listing, event, or guide.`;
  }
  if (place.kind === "everywhere") {
    return "No phones matched. Open the Venturo Application while signed in so the phone can register.";
  }
  return `No phones within ${PLACE_REACH_KM} km of ${place.label} matched. A member receives this when their home area is inside that reach.`;
}

async function filterNotice(service: Service, rows: DeviceRow[], draft: PushDraft) {
  if (draft.notice === "custom" || draft.notice === "remind" || draft.notice === "weekend") return { rows };
  const userIds = uniqueUsers(rows);
  const allowed = new Set<string>();

  for (const batch of chunks(userIds, 200)) {
    if (batch.length === 0) continue;
    if (draft.notice === "community") {
      const follows = await service
        .from("community_follows")
        .select("user_id")
        .eq("community_id", draft.target)
        .in("user_id", batch);
      if (follows.error) return { error: follows.error.message, rows: [] as DeviceRow[] };
      for (const row of follows.data ?? []) allowed.add(row.user_id as string);
    } else if (draft.notice === "interest") {
      const interests = await service
        .from("profile_interests")
        .select("profile_id")
        .eq("interest_id", draft.target)
        .in("profile_id", batch);
      if (interests.error) return { error: interests.error.message, rows: [] as DeviceRow[] };
      for (const row of interests.data ?? []) allowed.add(row.profile_id as string);
    } else {
      const saves = await service.from("member_saves").select("user_id").in("user_id", batch);
      if (saves.error) return { error: saves.error.message, rows: [] as DeviceRow[] };
      for (const row of saves.data ?? []) allowed.add(row.user_id as string);
    }
  }

  return { rows: rows.filter((row) => allowed.has(row.user_id)) };
}

async function nearbyPlaceIds(service: Service, originId: string): Promise<{ error: string } | { ids: Set<string> }> {
  const { data, error } = await service.from("places").select("id, lat, lng").eq("is_active", true);
  if (error) return { error: error.message };

  const rows = (data ?? []) as { id: string; lat: number | string | null; lng: number | string | null }[];
  const origin = rows.find((row) => row.id === originId);
  const ids = new Set<string>([originId]);
  const originLat = Number(origin?.lat);
  const originLng = Number(origin?.lng);
  if (!Number.isFinite(originLat) || !Number.isFinite(originLng)) return { ids };

  for (const row of rows) {
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (distanceKm(originLat, originLng, lat, lng) <= PLACE_REACH_KM) ids.add(row.id);
  }

  return { ids };
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

function guideIsOpen(publishAt: string | null, expireAt: string | null) {
  const now = Date.now();
  if (publishAt && new Date(publishAt).getTime() > now) return false;
  if (expireAt && new Date(expireAt).getTime() <= now) return false;
  return true;
}

export async function loadPushOptions() {
  const empty = {
    guides: [] as PushOpenOption[],
    events: [] as PushOpenOption[],
    places: [] as PushPlaceOption[],
    communities: [] as PushTargetOption[],
    interests: [] as PushTargetOption[],
  };
  const service = createServiceClient();
  if (!service) return empty;

  const [guides, events, places, communities, interests] = await Promise.all([
    service.from("curated_guides").select("id, title, slug, status, publish_at, expire_at").eq("status", "published").order("title"),
    service
      .from("events")
      .select("id, title, slug, city, starts_at, status")
      .eq("status", "approved")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(40),
    service.from("places").select("id, name, region").eq("is_active", true).order("region").order("name"),
    service.from("communities").select("id, title").eq("status", "published").order("title").limit(80),
    service.from("interests").select("id, title").eq("is_active", true).order("title"),
  ]);

  return {
    guides: ((guides.data ?? []) as { id: string; title: string; publish_at: string | null; expire_at: string | null }[])
      .filter((guide) => guideIsOpen(guide.publish_at, guide.expire_at))
      .map((guide) => ({ kind: "guide" as const, id: guide.id, title: guide.title, detail: null })),
    events: ((events.data ?? []) as { id: string; title: string; city: string | null }[]).map((event) => ({
      kind: "event" as const,
      id: event.id,
      title: event.title,
      detail: event.city,
    })),
    places: ((places.data ?? []) as { id: string; name: string | null; region: string | null }[]).flatMap((place) => {
      const name = place.name?.trim();
      const region = place.region?.trim();
      if (!name || !region) return [];
      return [{ id: place.id, name, region }];
    }),
    communities: ((communities.data ?? []) as { id: string; title: string | null }[]).flatMap((community) => {
      const title = community.title?.trim();
      if (!title) return [];
      return [{ id: community.id, title }];
    }),
    interests: ((interests.data ?? []) as { id: string; title: string | null }[]).flatMap((interest) => {
      const title = interest.title?.trim();
      if (!title) return [];
      return [{ id: interest.id, title }];
    }),
  };
}

async function pushTokens(
  rows: DeviceRow[],
  message: { title: string; body: string; path: string | null; kind: string; id: string; slug: string; when: string; campaignId: string },
) {
  const targets = rows.filter((row): row is DeviceRow & { token: string } => Boolean(row.token));
  if (targets.length === 0) {
    return { pushed: 0, failed: 0, attempted: 0, dropTokenIds: [] as string[], error: null };
  }

  let pushed = 0;
  let failed = 0;
  const dropTokenIds: string[] = [];
  let error: string | null = null;

  for (const batch of chunks(targets, 100)) {
    const result = await sendExpoBatch(batch, message);
    pushed += result.pushed;
    failed += result.failed;
    dropTokenIds.push(...result.dropTokenIds);
    error = error ?? result.error;
  }

  return { pushed, failed, attempted: targets.length, dropTokenIds, error };
}

async function sendExpoBatch(
  batch: Array<DeviceRow & { token: string }>,
  message: { title: string; body: string; path: string | null; kind: string; id: string; slug: string; when: string; campaignId: string },
) {
  const accessToken = process.env.EXPO_ACCESS_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response: Response;
  try {
    response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(
        batch.map((device) => ({
          to: device.token,
          title: message.title,
          body: message.body,
          sound: "default",
          channelId: "default",
          data: {
            path: message.path ?? "",
            kind: message.kind,
            id: message.id,
            slug: message.slug,
            when: message.when,
            campaignId: message.campaignId,
          },
        })),
      ),
    });
  } catch (error) {
    return {
      pushed: 0,
      failed: batch.length,
      dropTokenIds: [] as string[],
      error: error instanceof Error ? error.message : "Expo push did not respond.",
    };
  }

  const payload = (await response.json().catch(() => null)) as {
    data?: Array<{ status?: string; message?: string; details?: { error?: string } }>;
    errors?: Array<{ message?: string }>;
  } | null;

  if (!response.ok || !payload?.data) {
    const detail = payload?.errors?.[0]?.message;
    return {
      pushed: 0,
      failed: batch.length,
      dropTokenIds: [] as string[],
      error: detail || `Expo push returned ${response.status}.`,
    };
  }

  let pushed = 0;
  let failed = 0;
  const dropTokenIds: string[] = [];
  let error: string | null = null;

  payload.data.forEach((ticket, index) => {
    if (ticket.status === "ok") {
      pushed += 1;
      return;
    }
    failed += 1;
    error = error ?? ticket.message ?? "Expo could not deliver a push.";
    if (ticket.details?.error === "DeviceNotRegistered") {
      const device = batch[index];
      if (device) dropTokenIds.push(device.id);
    }
  });

  return { pushed, failed, dropTokenIds, error };
}

function chunks<T>(items: T[], size: number) {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}
