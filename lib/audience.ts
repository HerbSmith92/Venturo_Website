import "server-only";

import { getCurrentUser } from "@/lib/auth";
import { parseContentAudience, type ContentAudience } from "@/lib/content-audience";
import { isStaff, type AppRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export type { ContentAudience } from "@/lib/content-audience";
export {
  AUDIENCE_OPTIONS,
  audienceBadge,
  audienceAllowedForCommunity,
  parseContentAudience,
  requiredEventAudienceForCommunity,
} from "@/lib/content-audience";

export type ProfileGender = "woman" | "man" | "non-binary" | "prefer-not-to-say" | null;

export type AudienceViewer = {
  userId: string | null;
  role: AppRole | null;
  gender: ProfileGender;
  /** Eligible to see women-only public content. */
  canViewWomen: boolean;
  /** Eligible to see men-only public content. */
  canViewMen: boolean;
};

export function parseProfileGender(value: string | null | undefined): ProfileGender {
  if (value === "woman" || value === "man" || value === "non-binary" || value === "prefer-not-to-say") {
    return value;
  }
  return null;
}

export function viewerFromGender(
  gender: ProfileGender,
  userId: string | null = null,
  role: AppRole | null = null,
): AudienceViewer {
  return {
    userId,
    role,
    gender,
    canViewWomen: gender === "woman",
    canViewMen: gender === "man",
  };
}

export const ANON_VIEWER: AudienceViewer = viewerFromGender(null);

export async function loadAudienceViewer(): Promise<AudienceViewer> {
  const user = await getCurrentUser();
  if (!user) return ANON_VIEWER;
  const supabase = await createClient();
  if (!supabase) return viewerFromGender(null, user.id, user.role);
  const { data } = await supabase.from("profiles").select("gender").eq("id", user.id).maybeSingle();
  return viewerFromGender(parseProfileGender(data?.gender as string | null), user.id, user.role);
}

/** Public discovery eligibility (not management access). */
export function canViewAudiencePublic(audience: ContentAudience, viewer: AudienceViewer): boolean {
  if (audience === "all") return true;
  if (audience === "women") return viewer.canViewWomen;
  if (audience === "men") return viewer.canViewMen;
  return false;
}

export function isStaffViewer(viewer: AudienceViewer): boolean {
  return isStaff(viewer.role);
}

/** Filter rows that expose an `audience` field. */
export function filterByAudience<T extends { audience?: ContentAudience | string | null }>(
  rows: T[],
  viewer: AudienceViewer,
): T[] {
  return rows.filter((row) => canViewAudiencePublic(parseContentAudience(row.audience), viewer));
}
