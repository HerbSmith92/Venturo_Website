export const MAX_INTERESTS = 12;
export const MIN_INTERESTS = 3;

export type MemberProfile = {
  displayName: string;
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
  displayName: string;
  homePlaceId: string | null;
  personaIds: string[];
  interestIds: string[];
  energyLow: number | null;
  energyHigh: number | null;
}) {
  if (!input.displayName) return "identity";
  if (!input.homePlaceId) return "home_place";
  if (input.personaIds.length === 0) return "personas";
  if (input.interestIds.length < MIN_INTERESTS) return "interests";
  if (input.energyLow == null || input.energyHigh == null) return "activity_scale";
  return "complete";
}
