import { BasicsForm } from "@/components/onboarding/BasicsForm";
import { ConfirmForm } from "@/components/onboarding/ConfirmForm";
import { EnergyForm } from "@/components/onboarding/EnergyForm";
import { InterestBubbles } from "@/components/onboarding/InterestBubbles";
import { OnboardingFrame } from "@/components/onboarding/OnboardingFrame";
import { PersonasForm } from "@/components/onboarding/PersonasForm";
import { PlanChoice } from "@/components/onboarding/PlanChoice";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/member-auth";
import {
  effectiveOnboardingPlan,
  isOnboardingStepId,
  onboardingHref,
  readOnboardingPlan,
  resolveOnboardingStep,
  stepsForPlan,
  type OnboardingStepId,
} from "@/lib/onboarding";
import { loadMemberProfile, loadProfileCatalog } from "@/lib/profile";
import { notFound, redirect } from "next/navigation";

export default async function OnboardingStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ step: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { step: rawStep } = await params;
  const query = await searchParams;
  if (!isOnboardingStepId(rawStep)) notFound();
  const step = rawStep as OnboardingStepId;
  const next = query.next ? safeNextPath(query.next) : "";

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/onboarding");

  const [profile, catalog, plan] = await Promise.all([
    loadMemberProfile(user.id),
    loadProfileCatalog(),
    readOnboardingPlan(),
  ]);
  const paid = user.plan === "paid";
  const resolved = resolveOnboardingStep(profile, plan, paid);
  if (resolved === "done") {
    const dest = next && !next.startsWith("/onboarding") && next !== "/account" ? next : "/";
    redirect(dest);
  }

  const chosen = effectiveOnboardingPlan(plan, paid);
  const path = stepsForPlan(chosen);
  const resolvedIndex = path.indexOf(resolved);
  const stepIndex = path.indexOf(step);
  if (stepIndex === -1 || (resolvedIndex >= 0 && stepIndex > resolvedIndex)) {
    redirect(onboardingHref(resolved, next || null));
  }

  const firstName = profile.firstName.trim() || user.firstName;
  const formProfile = { ...profile, firstName };
  const wide = step === "interests" || step === "plan";

  return (
    <OnboardingFrame step={step} plan={chosen} next={next || null} wide={wide}>
      {step === "plan" && <PlanChoice plan={chosen} next={next || null} paid={paid} />}
      {step === "basics" && chosen && (
        <BasicsForm profile={formProfile} catalog={catalog} plan={chosen} next={next || null} />
      )}
      {step === "personas" && (
        <PersonasForm profile={formProfile} catalog={catalog} next={next || null} />
      )}
      {step === "interests" && (
        <InterestBubbles profile={formProfile} catalog={catalog} next={next || null} />
      )}
      {step === "energy" && (
        <EnergyForm profile={formProfile} catalog={catalog} next={next || null} />
      )}
      {step === "confirm" && chosen && (
        <ConfirmForm
          profile={formProfile}
          catalog={catalog}
          plan={chosen}
          email={user.email ?? ""}
          next={next || null}
        />
      )}
    </OnboardingFrame>
  );
}
