"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveOnboardingProfile, skipOnboarding } from "@/lib/onboarding-client";
import { onboardingHref, type OnboardingStepId } from "@/lib/onboarding-shared";
import type { OnboardingAdvanceStep } from "@/lib/profile-shared";

export function OnboardingSkipStep({
  next,
  advanceStep,
  to,
  extra,
}: {
  next?: string | null;
  advanceStep: OnboardingAdvanceStep;
  to: OnboardingStepId;
  extra?: Record<string, unknown>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSkip() {
    setPending(true);
    try {
      await saveOnboardingProfile({ ...extra, advanceStep });
      router.push(onboardingHref(to, next));
      router.refresh();
    } catch {
      setPending(false);
    }
  }

  return (
    <button className="btn btn-ghost" type="button" disabled={pending} onClick={() => void onSkip()}>
      {pending ? "Please Wait" : "Skip This"}
    </button>
  );
}

export function OnboardingSkipAll({ next }: { next?: string | null }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSkip() {
    setError(null);
    setPending(true);
    try {
      await skipOnboarding(next);
    } catch (caught) {
      setPending(false);
      setError(caught instanceof Error ? caught.message : "Could not skip.");
    }
  }

  return (
    <div className="onboarding-skip">
      <button className="btn btn-ghost" type="button" disabled={pending} onClick={() => void onSkip()}>
        {pending ? "Please Wait" : "Skip For Now"}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
