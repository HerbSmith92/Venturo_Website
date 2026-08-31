export const MAX_INTERESTS = 12;
export const MIN_INTERESTS = 3;

export type ProfileProgressStep = {
  id: string;
  label: string;
  done: boolean;
};

export type MemberProfile = {
  firstName: string;
  lastName: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  homePlaceId: string | null;
  energyLow: number | null;
  energyHigh: number | null;
  onboardingStep: string;
  onboardingCompletedAt: string | null;
  interestIds: string[];
  personaIds: string[];
};

export type ProfileCatalog = {
  places: { id: string; name: string; region: string | null }[];
  personas: { id: string; title: string; subtitle: string | null }[];
  scales: { rank: number; title: string; subtitle: string | null }[];
  interests: {
    id: string;
    title: string;
    kind_key: string;
    kind_title: string;
  }[];
};

export function onboardingStepFor(input: {
  firstName: string;
  homePlaceId: string | null;
  personaIds: string[];
  interestIds: string[];
  energyLow: number | null;
  energyHigh: number | null;
}) {
  if (!input.firstName.trim()) return "identity";
  if (!input.homePlaceId) return "home_place";
  if (input.personaIds.length === 0) return "personas";
  if (input.interestIds.length < MIN_INTERESTS) return "interests";
  if (input.energyLow == null || input.energyHigh == null) return "activity_scale";
  return "complete";
}

export function profileProgress(input: {
  firstName: string;
  avatarUrl: string | null;
  homePlaceId: string | null;
  personaIds: string[];
  interestIds: string[];
  energyLow: number | null;
  energyHigh: number | null;
}): { steps: ProfileProgressStep[]; doneCount: number; complete: boolean } {
  const steps: ProfileProgressStep[] = [
    { id: "photo", label: "Photo", done: Boolean(input.avatarUrl) },
    { id: "identity", label: "Name", done: Boolean(input.firstName.trim()) },
    { id: "home_place", label: "Home area", done: Boolean(input.homePlaceId) },
    { id: "personas", label: "How you go", done: input.personaIds.length > 0 },
    {
      id: "interests",
      label: "Interests",
      done: input.interestIds.length >= MIN_INTERESTS,
    },
    {
      id: "activity_scale",
      label: "Activity",
      done: input.energyLow != null && input.energyHigh != null,
    },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  return {
    steps,
    doneCount,
    complete: doneCount === steps.length,
  };
}
