"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveOnboardingPlan, saveOnboardingProfile } from "@/lib/onboarding-client";
import {
  destinationAfterOnboarding,
  onboardingHref,
  type OnboardingPlan,
} from "@/lib/onboarding-shared";
import type { MemberProfile, ProfileCatalog } from "@/lib/profile-shared";

export function BasicsForm({
  profile,
  catalog,
  next,
}: {
  profile: MemberProfile;
  catalog: ProfileCatalog;
  plan: OnboardingPlan;
  next?: string | null;
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [homePlaceId, setHomePlaceId] = useState(profile.homePlaceId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const regions = useMemo(() => {
    const groups = new Map<string, { id: string; name: string }[]>();
    for (const place of catalog.places) {
      const region = place.region ?? "South Africa";
      const list = groups.get(region) ?? [];
      list.push(place);
      groups.set(region, list);
    }
    return [...groups.entries()];
  }, [catalog.places]);

  function requireBasics() {
    if (!firstName.trim()) {
      setError("First name is required.");
      return false;
    }
    if (!homePlaceId) {
      setError("Pick your home area so we can show what’s nearby.");
      return false;
    }
    return true;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireBasics()) return;
    setError(null);
    setPending(true);
    try {
      await saveOnboardingProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        homePlaceId,
      });
      const onward = "personas";
      router.push(onboardingHref(onward, next));
      router.refresh();
    } catch (caught) {
      setPending(false);
      setError(caught instanceof Error ? caught.message : "Could not save.");
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <p className="eyebrow">A Few Basics</p>
      <h1>Who’s Exploring?</h1>
      <p className="lede muted">
        Name & home area first. Next you can tell us how you go out, or skip those screens & jump in
        free.
      </p>
      <label className="field">
        <span>First Name</span>
        <input
          name="firstName"
          type="text"
          autoComplete="given-name"
          required
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Last Name</span>
        <input
          name="lastName"
          type="text"
          autoComplete="family-name"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Home Area</span>
        <select
          name="homePlaceId"
          required
          value={homePlaceId}
          onChange={(event) => setHomePlaceId(event.target.value)}
        >
          <option value="">Pick your area</option>
          {regions.map(([region, places]) => (
            <optgroup key={region} label={region}>
              {places.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {error && <p className="error">{error}</p>}
      <div className="onboarding-actions">
        <a className="btn btn-ghost" href={onboardingHref("plan", next)}>
          Back
        </a>
        <button
          className="btn btn-ghost"
          type="button"
          disabled={pending}
          onClick={() => {
            if (!requireBasics()) return;
            setError(null);
            setPending(true);
            void (async () => {
              try {
                await saveOnboardingPlan("free");
                await saveOnboardingProfile({
                  firstName: firstName.trim(),
                  lastName: lastName.trim(),
                  homePlaceId,
                  plan: "free",
                  finishOnboarding: true,
                });
                window.location.href = destinationAfterOnboarding(next, "free");
              } catch (caught) {
                setPending(false);
                setError(caught instanceof Error ? caught.message : "Could not skip.");
              }
            })();
          }}
        >
          {pending ? "Please Wait" : "Skip Extra Questions"}
        </button>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Please Wait" : "Continue"}
        </button>
      </div>
    </form>
  );
}
