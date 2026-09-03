"use client";

import { useState } from "react";
import { PAID_PRICE } from "@/lib/brand";
import { saveOnboardingProfile } from "@/lib/onboarding-client";
import {
  destinationAfterOnboarding,
  onboardingHref,
  type OnboardingPlan,
} from "@/lib/onboarding-shared";
import type { MemberProfile, ProfileCatalog } from "@/lib/profile-shared";

export function ConfirmForm({
  profile,
  catalog,
  plan,
  email,
  next,
}: {
  profile: MemberProfile;
  catalog: ProfileCatalog;
  plan: OnboardingPlan;
  email: string;
  next?: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const homeLabel =
    catalog.places.find((place) => place.id === profile.homePlaceId)?.name ?? "Not set yet";
  const personas = catalog.personas
    .filter((persona) => profile.personaIds.includes(persona.id))
    .map((persona) => persona.title);
  const interests = catalog.interests
    .filter((item) => profile.interestIds.includes(item.id))
    .map((item) => item.title);
  const lowTitle = catalog.scales.find((scale) => scale.rank === profile.energyLow)?.title;
  const highTitle = catalog.scales.find((scale) => scale.rank === profile.energyHigh)?.title;
  const energyLabel =
    lowTitle && highTitle
      ? lowTitle === highTitle
        ? lowTitle
        : `${lowTitle} – ${highTitle}`
      : null;

  async function finish() {
    setError(null);
    setPending(true);
    try {
      await saveOnboardingProfile({
        firstName: profile.firstName,
        lastName: profile.lastName,
        homePlaceId: profile.homePlaceId,
        personaIds: profile.personaIds,
        interestIds: profile.interestIds,
        energyLow: profile.energyLow,
        energyHigh: profile.energyHigh,
        plan,
        finishOnboarding: true,
      });
      window.location.href = destinationAfterOnboarding(next, plan);
    } catch (caught) {
      setPending(false);
      setError(caught instanceof Error ? caught.message : "Could not finish onboarding.");
    }
  }

  return (
    <div>
      <p className="eyebrow">Almost There</p>
      <h1>Looks Good?</h1>
      <p className="lede muted">
        {plan === "free"
          ? "Quick check, then you’re in. Add interests anytime from your profile."
          : `Check this, then continue to PayFast for ${PAID_PRICE} / month.`}
      </p>
      <dl className="onboarding-summary">
        <div>
          <dt>Name</dt>
          <dd>
            {[profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Not set yet"}
          </dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{email || "On your account"}</dd>
        </div>
        <div>
          <dt>Home Area</dt>
          <dd>{homeLabel}</dd>
        </div>
        <div>
          <dt>Plan</dt>
          <dd>{plan === "free" ? "Free" : `Subscribe · ${PAID_PRICE} / month`}</dd>
        </div>
        {plan === "subscribe" && (
          <>
            <div>
              <dt>How You Go Out</dt>
              <dd>{personas.length > 0 ? personas.join(", ") : "Not set yet"}</dd>
            </div>
            <div>
              <dt>Interests</dt>
              <dd>{interests.length > 0 ? interests.join(", ") : "Not set yet"}</dd>
            </div>
            <div>
              <dt>Energy</dt>
              <dd>{energyLabel ?? "Not set yet"}</dd>
            </div>
          </>
        )}
      </dl>
      {plan === "subscribe" && (
        <p className="muted">
          Next step is PayFast sandbox / live checkout for {PAID_PRICE} / month. App Store & Play
          Store remain available once the apps are published.
        </p>
      )}
      {error && <p className="error">{error}</p>}
      <div className="onboarding-actions">
        <a
          className="btn btn-ghost"
          href={onboardingHref(plan === "free" ? "basics" : "energy", next)}
        >
          Back
        </a>
        <button className="btn btn-primary" type="button" disabled={pending} onClick={() => void finish()}>
          {pending
            ? "Please Wait"
            : plan === "free"
              ? "Take Me Exploring"
              : "Continue To Subscribe"}
        </button>
      </div>
      {plan === "free" && (
        <p className="muted" style={{ marginTop: 16 }}>
          Want Made For You later? <a href="/account">Tell us more on your profile</a>.
        </p>
      )}
    </div>
  );
}
