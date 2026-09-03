import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/member-auth";
import {
  onboardingHref,
  readOnboardingPlan,
  resolveOnboardingStep,
} from "@/lib/onboarding";
import { loadMemberProfile } from "@/lib/profile";
import { redirect } from "next/navigation";

export default async function OnboardingIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ? safeNextPath(params.next) : "";
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/onboarding");

  const [profile, plan] = await Promise.all([
    loadMemberProfile(user.id),
    readOnboardingPlan(),
  ]);
  const resolved = resolveOnboardingStep(profile, plan, user.plan === "paid");
  if (resolved === "done") {
    const dest = next && !next.startsWith("/onboarding") && next !== "/account" ? next : "/";
    redirect(dest);
  }
  redirect(onboardingHref(resolved, next || null));
}
