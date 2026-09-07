import { APP_ROLES, type AppRole } from "@/lib/roles";
import { safeNextPath } from "@/lib/safe-path";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export { safeNextPath };

function asAppRole(value: unknown): AppRole | null {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole)
    ? (value as AppRole)
    : null;
}

function displayNameFrom(user: User, firstName?: string) {
  const typed = firstName?.trim();
  if (typed) return typed.slice(0, 80);
  const meta = user.user_metadata as {
    first_name?: string;
    given_name?: string;
    name?: string;
    full_name?: string;
  } | undefined;
  const fromMeta =
    meta?.first_name?.trim() ||
    meta?.given_name?.trim() ||
    meta?.name?.trim()?.split(/\s+/)[0] ||
    meta?.full_name?.trim()?.split(/\s+/)[0];
  return fromMeta ? fromMeta.slice(0, 80) : "";
}

/**
 * After OTP / magic-link success: set `member` in app_metadata (never overwrite
 * staff or business) and copy the first name onto the shared profiles row.
 */
export async function provisionMember(userId: string, firstName?: string) {
  const admin = createServiceClient();
  if (admin) {
    const { data } = await admin.auth.admin.getUserById(userId);
    const user = data.user;
    if (!user) return;

    const existingRole = asAppRole(user.app_metadata?.role);
    const appMetadata = { ...(user.app_metadata ?? {}) };
    if (!existingRole) appMetadata.role = "member";

    const displayName = displayNameFrom(user, firstName);
    await admin.auth.admin.updateUserById(userId, {
      app_metadata: appMetadata,
      user_metadata: {
        ...(user.user_metadata ?? {}),
        ...(displayName ? { first_name: displayName } : {}),
      },
    });

    const { data: profile } = await admin
      .from("profiles")
      .select("id, display_name")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      await admin.from("profiles").insert({
        id: userId,
        display_name: displayName || null,
        onboarding_step: "identity",
        onboarding_version: 1,
      });
      return;
    }

    if (displayName && (!profile.display_name || firstName?.trim())) {
      await admin.from("profiles").update({ display_name: displayName }).eq("id", userId);
    }
    return;
  }

  const supabase = await createClient();
  if (!supabase) return;

  await supabase.rpc("ensure_member_role", { target: userId });
  const name = firstName?.trim();
  if (name) {
    await supabase.auth.updateUser({ data: { first_name: name } });
    await supabase.from("profiles").update({ display_name: name }).eq("id", userId);
  }
}
