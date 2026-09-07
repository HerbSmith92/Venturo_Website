import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPaidMembershipDetail } from "@/lib/revenuecat";

export type Plan = "guest" | "free" | "paid";

export type MemberAccessRow = {
  user_id: string;
  subscribed: boolean;
  payfast_active: boolean;
  revenuecat_active: boolean;
  current_period_end: string | null;
};

async function serviceOrUserClient() {
  const service = createServiceClient();
  if (service) return service;
  return createClient();
}

export async function ensureMemberAccessRow(userId: string) {
  const service = createServiceClient();
  if (!service) return false;
  const { error } = await service.from("member_access").upsert(
    { user_id: userId },
    { onConflict: "user_id", ignoreDuplicates: true },
  );
  if (error) {
    console.error("ensureMemberAccessRow", error.message);
    return false;
  }
  return true;
}

export async function isMemberAccessSubscribed(userId: string) {
  const supabase = await createClient();
  if (!supabase) return false;
  const { data } = await supabase
    .from("member_access")
    .select("subscribed")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data?.subscribed);
}

export async function getMemberAccessMap(userIds: string[]) {
  const map = new Map<string, boolean>();
  if (userIds.length === 0) return map;
  const client = (await serviceOrUserClient()) ?? (await createClient());
  if (!client) return map;

  const { data } = await client
    .from("member_access")
    .select("user_id, subscribed")
    .in("user_id", userIds);

  for (const row of data ?? []) {
    if (typeof row.user_id === "string" && row.subscribed) {
      map.set(row.user_id, true);
    }
  }
  return map;
}

export async function setPayFastAccess(
  userId: string,
  active: boolean,
  currentPeriodEnd?: string | null,
) {
  const service = createServiceClient();
  if (!service) return false;
  const ensured = await ensureMemberAccessRow(userId);
  if (!ensured) return false;
  const patch: Record<string, unknown> = { payfast_active: active };
  if (currentPeriodEnd !== undefined) {
    patch.current_period_end = currentPeriodEnd;
  }
  const { error } = await service.from("member_access").update(patch).eq("user_id", userId);
  if (error) {
    console.error("setPayFastAccess", error.message);
    return false;
  }
  return true;
}

export async function setRevenueCatAccess(
  userId: string,
  active: boolean,
  currentPeriodEnd?: string | null,
) {
  const service = createServiceClient();
  if (!service) return false;
  const ensured = await ensureMemberAccessRow(userId);
  if (!ensured) return false;
  const patch: Record<string, unknown> = { revenuecat_active: active };
  if (currentPeriodEnd !== undefined) {
    patch.current_period_end = currentPeriodEnd;
  }
  const { error } = await service.from("member_access").update(patch).eq("user_id", userId);
  if (error) {
    console.error("setRevenueCatAccess", error.message);
    return false;
  }
  return true;
}

export async function resolveAuthUserId(candidates: string[]) {
  const service = createServiceClient();
  if (!service) return null;
  const ids = [...new Set(candidates.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return null;
  const { data, error } = await service.rpc("resolve_auth_user_id", { p_ids: ids });
  if (error) {
    console.error("resolve_auth_user_id", error.message);
    return null;
  }
  return typeof data === "string" && data ? data : null;
}

type AuthUserLite = {
  id: string;
  legacyWpUserId: string | null;
};

async function listAuthUsersForBackfill(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
) {
  const users: AuthUserLite[] = [];
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) break;
    for (const user of data.users) {
      const legacy = user.app_metadata?.legacy_wp_user_id;
      users.push({
        id: user.id,
        legacyWpUserId:
          legacy === null || legacy === undefined || legacy === "" ? null : String(legacy),
      });
    }
    if (data.users.length < 200) break;
  }
  return users;
}

/** Service-role pass: PayFast from memberships, RevenueCat from the current API. */
export async function backfillMemberAccessFromSources() {
  const service = createServiceClient();
  if (!service) {
    return { ok: false as const, error: "SUPABASE_SERVICE_ROLE_KEY is missing." };
  }

  const { data: profiles, error: profileError } = await service.from("profiles").select("id");
  if (profileError) {
    return { ok: false as const, error: profileError.message };
  }

  const profileIds = (profiles ?? []).map((row) => row.id as string);
  if (profileIds.length) {
    await service.from("member_access").upsert(
      profileIds.map((id) => ({ user_id: id })),
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  }

  const { data: activeMemberships } = await service
    .from("memberships")
    .select("user_id, current_period_end")
    .eq("status", "active");

  const payfastByUser = new Map<string, string | null>();
  for (const row of activeMemberships ?? []) {
    if (typeof row.user_id !== "string") continue;
    const next = typeof row.current_period_end === "string" ? row.current_period_end : null;
    const current = payfastByUser.get(row.user_id);
    if (!payfastByUser.has(row.user_id) || (next && (!current || next > current))) {
      payfastByUser.set(row.user_id, next);
    }
  }

  if (profileIds.length) {
    await service.from("member_access").update({ payfast_active: false }).in("user_id", profileIds);
  }
  for (const [userId, periodEnd] of payfastByUser) {
    await service
      .from("member_access")
      .update({ payfast_active: true, current_period_end: periodEnd })
      .eq("user_id", userId);
  }

  const users = await listAuthUsersForBackfill(service);
  const rcReady = Boolean(process.env.REVENUECAT_SECRET_API_KEY?.trim());
  let revenueCatChecked = 0;
  let revenueCatActive = 0;

  if (rcReady) {
    for (const user of users) {
      const [byId, byLegacy] = await Promise.all([
        getPaidMembershipDetail(user.id),
        user.legacyWpUserId ? getPaidMembershipDetail(user.legacyWpUserId) : Promise.resolve(null),
      ]);
      revenueCatChecked += 1;
      const active = Boolean(byId?.active || byLegacy?.active);
      const expiresAt = byId?.expiresAt ?? byLegacy?.expiresAt ?? null;
      if (active) revenueCatActive += 1;
      await setRevenueCatAccess(user.id, active, active ? expiresAt : undefined);
    }
  }

  return {
    ok: true as const,
    profiles: profileIds.length,
    payfastActive: payfastByUser.size,
    revenueCatChecked,
    revenueCatActive,
  };
}
