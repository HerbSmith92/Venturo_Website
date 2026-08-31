import { createClient } from "@/lib/supabase/server";
import type { MemberProfile, ProfileCatalog } from "@/lib/profile-shared";

export {
  MAX_INTERESTS,
  MIN_INTERESTS,
  onboardingStepFor,
  profileProgress,
  type MemberProfile,
  type ProfileCatalog,
  type ProfileProgressStep,
} from "@/lib/profile-shared";

const EMPTY_PROFILE: MemberProfile = {
  firstName: "",
  lastName: "",
  avatarPath: null,
  avatarUrl: null,
  homePlaceId: null,
  energyLow: null,
  energyHigh: null,
  onboardingStep: "identity",
  onboardingCompletedAt: null,
  interestIds: [],
  personaIds: [],
};

const EMPTY_CATALOG: ProfileCatalog = {
  places: [],
  personas: [],
  scales: [],
  interests: [],
};

export async function loadMemberProfile(userId: string): Promise<MemberProfile> {
  const supabase = await createClient();
  if (!supabase) return EMPTY_PROFILE;

  const [profile, interests, personas] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "display_name, last_name, avatar_path, home_place_id, activity_scale_low, activity_scale_high, onboarding_step, onboarding_completed_at",
      )
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("profile_interests").select("interest_id").eq("profile_id", userId),
    supabase.from("profile_personas").select("persona_id").eq("profile_id", userId),
  ]);

  const row = profile.data;
  if (!row) return EMPTY_PROFILE;

  const avatarPath = typeof row.avatar_path === "string" ? row.avatar_path : null;
  let avatarUrl: string | null = null;
  if (avatarPath) {
    const { data: signed } = await supabase.storage
      .from("avatars")
      .createSignedUrl(avatarPath, 60 * 60);
    avatarUrl = signed?.signedUrl ?? null;
  }

  return {
    firstName: row.display_name ?? "",
    lastName: row.last_name ?? "",
    avatarPath,
    avatarUrl,
    homePlaceId: row.home_place_id,
    energyLow: row.activity_scale_low,
    energyHigh: row.activity_scale_high,
    onboardingStep: row.onboarding_step,
    onboardingCompletedAt: row.onboarding_completed_at,
    interestIds: (interests.data ?? []).map((item) => item.interest_id),
    personaIds: (personas.data ?? []).map((item) => item.persona_id),
  };
}

export async function loadProfileCatalog(): Promise<ProfileCatalog> {
  const supabase = await createClient();
  if (!supabase) return EMPTY_CATALOG;

  const [places, personas, scales, interests] = await Promise.all([
    supabase
      .from("places")
      .select("id, name, region")
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("personas")
      .select("id, title, subtitle")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("activity_scales")
      .select("rank, title, subtitle")
      .eq("is_active", true)
      .order("rank"),
    supabase
      .from("interests")
      .select("id, title, activity_kinds ( key, title )")
      .eq("is_active", true)
      .order("title"),
  ]);

  type InterestRow = {
    id: string;
    title: string;
    activity_kinds: { key: string; title: string } | { key: string; title: string }[] | null;
  };

  return {
    places: (places.data ?? []) as ProfileCatalog["places"],
    personas: (personas.data ?? []) as ProfileCatalog["personas"],
    scales: ((scales.data ?? []) as { rank: number; title: string; subtitle: string | null }[]).map(
      (row) => ({ rank: Number(row.rank), title: row.title, subtitle: row.subtitle }),
    ),
    interests: ((interests.data ?? []) as InterestRow[]).map((row) => {
      const kind = Array.isArray(row.activity_kinds) ? row.activity_kinds[0] : row.activity_kinds;
      return {
        id: row.id,
        title: row.title,
        kind_key: kind?.key ?? "adventure",
        kind_title: kind?.title ?? "Adventure",
      };
    }),
  };
}
