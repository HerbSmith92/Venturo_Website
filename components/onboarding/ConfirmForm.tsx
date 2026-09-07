"use client";

import { useState } from "react";
import { PAID_PRICE } from "@/lib/brand";
import { saveOnboardingPlan, saveOnboardingProfile } from "@/lib/onboarding-client";
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
  const [pending, setPending] = useState<OnboardingPlan | null>(null);

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

  async function finish(nextPlan: OnboardingPlan) {
    setError(null);
    setPending(nextPlan);
    try {
      await saveOnboardingPlan(nextPlan);
      await saveOnboardingProfile({
        firstName: profile.firstName,
        lastName: profile.lastName,
        homePlaceId: profile.homePlaceId,
        personaIds: profile.personaIds,
        interestIds: profile.interestIds,
        energyLow: profile.energyLow,
        energyHigh: profile.energyHigh,
        plan: nextPlan,
        finishOnboarding: true,
      });
      window.location.href = destinationAfterOnboarding(next, nextPlan);
    } catch (caught) {
      setPending(null);
      setError(caught instanceof Error ? caught.message : "Could not finish onboarding.");
    }
  }

  return (
    <div>
      <p className="eyebrow">Almost There</p>
      <h1>Looks Good?</h1>
      <p className="lede muted">
        Start free whenever you like. Subscribe when you want Made For You & member prices.
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
          <dt>How You Go Out</dt>
          <dd>{personas.length > 0 ? personas.join(", ") : "Skipped for now"}</dd>
        </div>
        <div>
          <dt>Interests</dt>
          <dd>{interests.length > 0 ? interests.join(", ") : "Skipped for now"}</dd>
        </div>
        <div>
          <dt>Energy</dt>
          <dd>{energyLabel ?? "Skipped for now"}</dd>
        </div>
      </dl>
      {error && <p className="error">{error}</p>}
      <div className="onboarding-actions">
        <a className="btn btn-ghost" href={onboardingHref("energy", next)}>
          Back
        </a>
        <button
          className="btn btn-secondary"
          type="button"
          disabled={Boolean(pending)}
          onClick={() => void finish("free")}
        >
          {pending === "free" ? "Please Wait" : "Stay Free"}
        </button>
        <button
          className="btn btn-primary"
          type="button"
          disabled={Boolean(pending)}
          onClick={() => void finish("subscribe")}
        >
          {pending === "subscribe" ? "Please Wait" : `Subscribe · ${PAID_PRICE} / mo`}
        </button>
      </div>
      <p className="muted" style={{ marginTop: 16 }}>
        Free books event tickets. Paid is curated discovery & member prices. You can upgrade from
        your profile anytime.
        {plan === "subscribe" ? " You can still stay free — nothing is charged until you subscribe." : ""}
      </p>
    </div>
  );
}
