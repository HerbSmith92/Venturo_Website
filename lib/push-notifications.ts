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
  status: "sent" | "failed";
  device_count: number;
  inbox_count: number;
  pushed_count: number;
  failed_count: number;
  error: string | null;
  created_at: string;
};

export type PushDeviceStats = {
  companion: number;
  companionPush: number;
  member: number;
  memberPush: number;
};

export type PushDraft = {
  title: string;
  body: string;
  audience: PushAudience;
  app: PushApp;
  linkPath: string | null;
};

export type PushSendResult =
  | { error: string }
  | { inbox: number; pushed: number; failed: number; phones: number };

const LINK_PATH = /^\/[A-Za-z0-9][A-Za-z0-9/_-]{0,199}$/;
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export function pushAudienceLabel(audience: PushAudience) {
  if (audience === "everyone") return "Everyone with the app";
  if (audience === "paid") return "Paid members";
  if (audience === "free") return "Free members";
  return "Event hosts";
}

export function pushAppLabel(app: PushApp) {
  if (app === "companion") return "Companion";
  if (app === "member") return "Member app";
  return "Both apps";
}

export function parsePushDraft(input: {
  title: string;
  body: string;
  audience: string;
  app: string;
  linkPath: string;
}): { error: string } | { draft: PushDraft } {
  const title = input.title.trim();
  const body = input.body.trim();
  const linkPath = input.linkPath.trim();

  if (!title) return { error: "Add a title." as const };
  if (title.length > 80) return { error: "Title must be 80 characters or fewer." as const };
  if (!body) return { error: "Add a message." as const };
  if (body.length > 240) return { error: "Message must be 240 characters or fewer." as const };
  if (!isAudience(input.audience)) return { error: "Choose who should receive this." as const };
  if (!isApp(input.app)) return { error: "Choose which app should receive this." as const };
  if (linkPath && (!LINK_PATH.test(linkPath) || linkPath.includes("//") || linkPath.includes(".."))) {
    return { error: "Open path must start with / and stay inside the app." as const };
  }

  return {
    draft: {
      title,
      body,
      audience: input.audience,
      app: input.app,
      linkPath: linkPath || null,
    } satisfies PushDraft,
  };
}

export async function loadPushDesk() {
  const service = createServiceClient();
  if (!service) {
    return { serviceRoleReady: false as const, stats: emptyStats(), campaigns: [] as PushCampaign[], loadError: null };
  }

  const [companion, companionPush, member, memberPush, campaigns] = await Promise.all([
    countDevices(service, "companion", false),
    countDevices(service, "companion", true),
    countDevices(service, "member", false),
    countDevices(service, "member", true),
    service
      .from("push_campaigns")
      .select(
        "id, title, body, audience, app, link_path, status, device_count, inbox_count, pushed_count, failed_count, error, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const missing = [companion.error, companionPush.error, member.error, memberPush.error, campaigns.error].find(
    (error) => error,
  );

  return {
    serviceRoleReady: true as const,
    stats: {
      companion: companion.count ?? 0,
      companionPush: companionPush.count ?? 0,
      member: member.count ?? 0,
      memberPush: memberPush.count ?? 0,
    },
    campaigns: (campaigns.data ?? []) as PushCampaign[],
    loadError: missing ? missing.message : null,
  };
}

export async function deliverPushCampaign(draft: PushDraft, createdBy: string): Promise<PushSendResult> {
  const service = createServiceClient();
  if (!service) {
    return { error: "Add SUPABASE_SERVICE_ROLE_KEY before sending." };
  }

  const devices = await loadDevices(service, draft.app);
  if (devices.error) return { error: devices.error };

  const matched = await filterAudience(service, devices.rows, draft.audience);
  if (matched.error) return { error: matched.error };
  if (matched.rows.length === 0) {
    return {
      error: "No phones matched. Open the app while signed in so the phone can register.",
    };
  }

  const { data: campaign, error: insertError } = await service
    .from("push_campaigns")
    .insert({
      title: draft.title,
      body: draft.body,
      audience: draft.audience,
      app: draft.app,
      link_path: draft.linkPath,
      status: "sent",
      created_by: createdBy,
      device_count: matched.rows.length,
    })
    .select("id")
    .single();

  if (insertError || !campaign) {
    return { error: insertError?.message ?? "Could not save that notification." };
  }

  const users = uniqueUsers(matched.rows);
  const inbox = users.map((userId) => ({
    campaign_id: campaign.id,
    user_id: userId,
    title: draft.title,
    body: draft.body,
    link_path: draft.linkPath,
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

  const push = await pushTokens(matched.rows, {
    title: draft.title,
    body: draft.body,
    path: draft.linkPath,
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
    phones: matched.rows.length,
  };
}

function emptyStats(): PushDeviceStats {
  return { companion: 0, companionPush: 0, member: 0, memberPush: 0 };
}

function isAudience(value: string): value is PushAudience {
  return (PUSH_AUDIENCES as readonly string[]).includes(value);
}

function isApp(value: string): value is PushApp {
  return (PUSH_APPS as readonly string[]).includes(value);
}

type Service = NonNullable<ReturnType<typeof createServiceClient>>;

type DeviceRow = {
  id: string;
  user_id: string;
  token: string | null;
};

async function countDevices(service: Service, app: "companion" | "member", withToken: boolean) {
  let query = service.from("push_devices").select("id", { count: "exact", head: true }).eq("app", app);
  if (withToken) query = query.not("token", "is", null);
  const { count, error } = await query;
  return { count, error };
}

async function loadDevices(service: Service, app: PushApp) {
  const rows: DeviceRow[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    let query = service
      .from("push_devices")
      .select("id, user_id, token")
      .order("id")
      .range(from, from + pageSize - 1);
    if (app !== "both") query = query.eq("app", app);
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

async function pushTokens(
  rows: DeviceRow[],
  message: { title: string; body: string; path: string | null },
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
  message: { title: string; body: string; path: string | null },
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
          data: { path: message.path ?? "" },
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
