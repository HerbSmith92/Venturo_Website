"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EnergySpectrum } from "@/components/EnergySpectrum";
import { onboardingStepFor, type MemberProfile, type ProfileCatalog } from "@/lib/profile-shared";

export function ActivityForm({
  profile,
  catalog,
}: {
  profile: MemberProfile;
  catalog: ProfileCatalog;
}) {
  const router = useRouter();
  const [energyLow, setEnergyLow] = useState(
    profile.energyLow != null ? String(profile.energyLow) : "",
  );
  const [energyHigh, setEnergyHigh] = useState(
    profile.energyHigh != null ? String(profile.energyHigh) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
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
    setSaved(false);
    setPending(true);
    const nextEnergyLow = energyLow ? Number(energyLow) : null;
    const nextEnergyHigh = energyHigh ? Number(energyHigh) : null;
    const finishOnboarding =
      onboardingStepFor({
        firstName: profile.firstName,
        homePlaceId: profile.homePlaceId,
        personaIds: profile.personaIds,
        interestIds: profile.interestIds,
        energyLow: nextEnergyLow,
        energyHigh: nextEnergyHigh,
      }) === "complete";
    const response = await fetch("/api/account/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        energyLow: nextEnergyLow,
        energyHigh: nextEnergyHigh,
        finishOnboarding,
      }),
    });
    const payload = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not save your activity level.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <p className="muted">
        Set a range on the scale—from chilled to full throttle. This is your current mood, not a
        permanent setting.
      </p>
      <EnergySpectrum
        scales={catalog.scales}
        energyLow={energyLow}
        energyHigh={energyHigh}
        onPick={pickEnergy}
      />
      {(energyLow || energyHigh) && (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setEnergyLow("");
            setEnergyHigh("");
          }}
        >
          Clear Activity Level
        </button>
      )}
      {error && <p className="error">{error}</p>}
      {saved && <p className="notice">Saved. The app sees the same activity level.</p>}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Please Wait" : "Save Activity Level"}
      </button>
    </form>
  );
}
