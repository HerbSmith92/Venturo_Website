import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  loadMemberProfile,
  loadProfileCatalog,
  MAX_INTERESTS,
  onboardingStepFor,
} from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

function asIdList(value: unknown, allowed: Set<string>, max: number) {
  if (!Array.isArray(value)) return [] as string[];
  const unique = [...new Set(value.filter((item): item is string => typeof item === "string"))];
  return unique.filter((id) => allowed.has(id)).slice(0, max);
}

function asScale(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

async function syncJoin(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  table: "profile_interests" | "profile_personas",
  column: "interest_id" | "persona_id",
  userId: string,
  nextIds: string[],
) {
  const { data: existing, error: readError } = await supabase
    .from(table)
    .select("*")
    .eq("profile_id", userId);

  if (readError) return readError.message;

  const have = new Set(
    (existing ?? [])
      .map((row) => (row as Record<string, unknown>)[column])
      .filter((id): id is string => typeof id === "string"),
  );
  const next = new Set(nextIds);
  const toAdd = [...next].filter((id) => !have.has(id));
  const toRemove = [...have].filter((id) => !next.has(id));

  if (toRemove.length > 0) {
    const { error } = await supabase.from(table).delete().eq("profile_id", userId).in(column, toRemove);
    if (error) return error.message;
  }
  if (toAdd.length > 0) {
    const rows = toAdd.map((id) =>
      column === "interest_id"
        ? { profile_id: userId, interest_id: id, source: "explicit" }
        : { profile_id: userId, persona_id: id, source: "explicit" },
    );
    const { error } = await supabase.from(table).insert(rows);
    if (error) return error.message;
  }
  return null;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Log in to update your profile." }, { status: 401 });
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not connected yet." }, { status: 503 });
  }

  const body = (await request.json()) as {
    firstName?: string;
    lastName?: string;
    homePlaceId?: string | null;
    personaIds?: string[];
    interestIds?: string[];
    energyLow?: number | null;
    energyHigh?: number | null;
  };

  const firstName = String(body.firstName ?? "").trim().slice(0, 80);
  const lastName = String(body.lastName ?? "").trim().slice(0, 80);
  if (!firstName) {
    return NextResponse.json({ error: "First name is required." }, { status: 400 });
  }

  const catalog = await loadProfileCatalog();
  const placeIds = new Set(catalog.places.map((row) => row.id));
  const personaIds = asIdList(body.personaIds, new Set(catalog.personas.map((row) => row.id)), 8);
  const interestIds = asIdList(
    body.interestIds,
    new Set(catalog.interests.map((row) => row.id)),
    MAX_INTERESTS,
  );

  const homePlaceId =
    body.homePlaceId && placeIds.has(body.homePlaceId) ? body.homePlaceId : null;
  let energyLow = asScale(body.energyLow);
  let energyHigh = asScale(body.energyHigh);
  if (energyLow != null && energyHigh == null) energyHigh = energyLow;
  if (energyHigh != null && energyLow == null) energyLow = energyHigh;
  if (energyLow != null && energyHigh != null && energyLow > energyHigh) {
    return NextResponse.json(
      { error: "Activity range should run from calmer to more intense." },
      { status: 400 },
    );
  }

  const current = await loadMemberProfile(user.id);
  const step = onboardingStepFor({
    firstName,
    homePlaceId,
    personaIds,
    interestIds,
    energyLow,
    energyHigh,
  });

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      display_name: firstName,
      last_name: lastName || null,
      home_place_id: homePlaceId,
      activity_scale_low: energyLow,
      activity_scale_high: energyHigh,
      onboarding_step: step,
      onboarding_version: 1,
      onboarding_completed_at:
        step === "complete"
          ? (current.onboardingCompletedAt ?? new Date().toISOString())
          : current.onboardingCompletedAt,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const personaError = await syncJoin(
    supabase,
    "profile_personas",
    "persona_id",
    user.id,
    personaIds,
  );
  if (personaError) {
    return NextResponse.json({ error: personaError }, { status: 400 });
  }

  const interestError = await syncJoin(
    supabase,
    "profile_interests",
    "interest_id",
    user.id,
    interestIds,
  );
  if (interestError) {
    return NextResponse.json({ error: interestError }, { status: 400 });
  }

  await supabase.auth.updateUser({
    data: {
      first_name: firstName,
      last_name: lastName || null,
    },
  });

  return NextResponse.json({ ok: true, onboardingStep: step });
}
