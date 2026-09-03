import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { loadMemberProfile } from "@/lib/profile";
import {
  memberPostAuthPath,
  ONBOARDING_COOKIE,
  parseOnboardingPlan,
  type OnboardingPlan,
} from "@/lib/onboarding-shared";

export * from "@/lib/onboarding-shared";

export async function readOnboardingPlan() {
  const store = await cookies();
  return parseOnboardingPlan(store.get(ONBOARDING_COOKIE)?.value);
}

export async function postAuthPathAfterProvision(requestedNext: string) {
  const user = await getCurrentUser();
  if (!user) return requestedNext;
  const [profile, plan] = await Promise.all([
    loadMemberProfile(user.id),
    readOnboardingPlan(),
  ]);
  return memberPostAuthPath({
    role: user.role,
    profile,
    plan,
    paid: user.plan === "paid",
    requestedNext,
  });
}

export type { OnboardingPlan };
