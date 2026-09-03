import { MIN_INTERESTS, type MemberProfile } from "@/lib/profile-shared";
import { isStaff, type AppRole } from "@/lib/roles";
import { safeNextPath } from "@/lib/safe-path";

export const ONBOARDING_COOKIE = "venturo_onboarding_plan";
export const ONBOARDING_HOME = "/";
export const SUBSCRIBE_HANDOFF = "/join/subscribe?auto=1";

export type OnboardingPlan = "free" | "subscribe";
export type OnboardingStepId =
  | "plan"
  | "basics"
  | "personas"
  | "interests"
  | "energy"
  | "confirm";

export const ONBOARDING_STEP_ORDER: OnboardingStepId[] = [
  "plan",
  "basics",
  "personas",
  "interests",
  "energy",
  "confirm",
];

export function isOnboardingStepId(value: string): value is OnboardingStepId {
  return (ONBOARDING_STEP_ORDER as string[]).includes(value);
}

export function parseOnboardingPlan(raw: unknown): OnboardingPlan | null {
  return raw === "free" || raw === "subscribe" ? raw : null;
}

export function isOnboardingDone(profile: MemberProfile) {
  // Wizard Confirm (or a full account save) stamps this. Do not treat a full
  // field set alone as done — that skipped Confirm & the Subscribe handoff.
  return Boolean(profile.onboardingCompletedAt);
}

export function effectiveOnboardingPlan(
  plan: OnboardingPlan | null,
  paid: boolean,
): OnboardingPlan | null {
  if (paid) return "subscribe";
  return plan;
}

export function resolveOnboardingStep(
  profile: MemberProfile,
  plan: OnboardingPlan | null,
  paid: boolean,
): OnboardingStepId | "done" {
  if (isOnboardingDone(profile)) return "done";
  const chosen = effectiveOnboardingPlan(plan, paid);
  if (!chosen) return "plan";
  if (!profile.firstName.trim() || !profile.homePlaceId) return "basics";
  if (chosen === "free") return "confirm";
  if (profile.personaIds.length === 0) return "personas";
  if (profile.interestIds.length < MIN_INTERESTS) return "interests";
  if (profile.energyLow == null || profile.energyHigh == null) return "energy";
  return "confirm";
}

export function onboardingHref(step: OnboardingStepId, next?: string | null) {
  const path = `/onboarding/${step}`;
  const dest = next ? safeNextPath(next, "") : "";
  if (!dest || dest.startsWith("/onboarding")) return path;
  return `${path}?next=${encodeURIComponent(dest)}`;
}

export function stepsForPlan(plan: OnboardingPlan | null): OnboardingStepId[] {
  if (plan === "free") return ["plan", "basics", "confirm"];
  if (plan === "subscribe") {
    return ["plan", "basics", "personas", "interests", "energy", "confirm"];
  }
  return ["plan", "basics"];
}

export function destinationAfterOnboarding(
  requestedNext: string | null | undefined,
  plan: OnboardingPlan | null,
) {
  const next = requestedNext ? safeNextPath(requestedNext, "") : "";
  if (next && !next.startsWith("/onboarding") && next !== "/account") return next;
  if (plan === "subscribe") return SUBSCRIBE_HANDOFF;
  return ONBOARDING_HOME;
}

export function memberPostAuthPath(input: {
  role: AppRole | null;
  profile: MemberProfile;
  plan: OnboardingPlan | null;
  paid: boolean;
  requestedNext: string;
}) {
  if (isStaff(input.role)) {
    return input.requestedNext.startsWith("/admin") ? input.requestedNext : "/admin";
  }
  if (isOnboardingDone(input.profile)) {
    if (input.requestedNext.startsWith("/onboarding")) return ONBOARDING_HOME;
    return input.requestedNext;
  }
  const dest = input.requestedNext;
  if (dest && !dest.startsWith("/onboarding") && dest !== "/account") {
    return `/onboarding?next=${encodeURIComponent(dest)}`;
  }
  return "/onboarding";
}

export function onboardingPlanCookie(plan: OnboardingPlan) {
  return {
    name: ONBOARDING_COOKIE,
    value: plan,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  };
}
