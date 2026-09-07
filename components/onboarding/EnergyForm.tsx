"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EnergySpectrum } from "@/components/EnergySpectrum";
import { OnboardingSkipStep } from "@/components/onboarding/OnboardingSkip";
import { saveOnboardingProfile } from "@/lib/onboarding-client";
import { onboardingHref } from "@/lib/onboarding-shared";
import type { MemberProfile, ProfileCatalog } from "@/lib/profile-shared";

export function EnergyForm({
  profile,
  catalog,
  next,
}: {
  profile: MemberProfile;
  catalog: ProfileCatalog;
  next?: string | null;
}) {
  const router = useRouter();
  const [energyLow, setEnergyLow] = useState(
    profile.energyLow != null ? String(profile.energyLow) : "",
  );
  const [energyHigh, setEnergyHigh] = useState(
    profile.energyHigh != null ? String(profile.energyHigh) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function pickEnergy(rank: number) {
    const lo = energyLow ? Number(energyLow) : null;
    const hi = energyHigh ? Number(energyHigh) : null;
    if (lo == null || hi == null) {
      setEnergyLow(String(rank));
      setEnergyHigh(String(rank));
      return;
    }
    if (rank < lo) {
      setEnergyLow(String(rank));
      return;
    }
    if (rank > hi) {
      setEnergyHigh(String(rank));
      return;
    }
    setEnergyLow(String(rank));
    setEnergyHigh(String(rank));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await saveOnboardingProfile({
        energyLow: energyLow ? Number(energyLow) : null,
        energyHigh: energyHigh ? Number(energyHigh) : null,
        advanceStep: "payoff",
      });
      router.push(onboardingHref("confirm", next));
      router.refresh();
    } catch (caught) {
      setPending(false);
      setError(caught instanceof Error ? caught.message : "Could not save.");
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <p className="eyebrow">Getting To Know You</p>
      <h1>What Energy Are You Bringing?</h1>
      <p className="lede muted">
        This is a current mood, not a life sentence. You can change it anytime on your profile,
        or skip it for now.
      </p>
      <EnergySpectrum
        scales={catalog.scales}
        energyLow={energyLow}
        energyHigh={energyHigh}
        onPick={pickEnergy}
      />
      {error && <p className="error">{error}</p>}
      <div className="onboarding-actions">
        <a className="btn btn-ghost" href={onboardingHref("interests", next)}>
          Back
        </a>
        <OnboardingSkipStep next={next} advanceStep="payoff" to="confirm" />
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Please Wait" : "Continue"}
        </button>
      </div>
    </form>
  );
}
