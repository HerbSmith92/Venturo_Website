"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingSkipStep } from "@/components/onboarding/OnboardingSkip";
import { saveOnboardingProfile } from "@/lib/onboarding-client";
import { onboardingHref } from "@/lib/onboarding-shared";
import { MAX_PERSONAS, type MemberProfile, type ProfileCatalog } from "@/lib/profile-shared";

function toggleId(ids: string[], id: string, max: number) {
  if (ids.includes(id)) return ids.filter((item) => item !== id);
  if (ids.length >= max) return ids;
  return [...ids, id];
}

export function PersonasForm({
  profile,
  catalog,
  next,
}: {
  profile: MemberProfile;
  catalog: ProfileCatalog;
  next?: string | null;
}) {
  const router = useRouter();
  const [personaIds, setPersonaIds] = useState(profile.personaIds);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await saveOnboardingProfile({ personaIds, advanceStep: "interests" });
      router.push(onboardingHref("interests", next));
      router.refresh();
    } catch (caught) {
      setPending(false);
      setError(caught instanceof Error ? caught.message : "Could not save.");
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <p className="eyebrow">Getting To Know You</p>
      <h1>How You Usually Go Out</h1>
      <p className="lede muted">
        Who are you usually with? Pick every situation that fits. Skip if you’d rather say later.
      </p>
      <div className="tag-picker persona-picker">
        {catalog.personas.map((persona) => {
          const on = personaIds.includes(persona.id);
          return (
            <button
              key={persona.id}
              type="button"
              className={`chip chip-persona${on ? " on" : ""}`}
              onClick={() => setPersonaIds(toggleId(personaIds, persona.id, MAX_PERSONAS))}
            >
              <span>{persona.title}</span>
              {persona.subtitle && <small>{persona.subtitle}</small>}
            </button>
          );
        })}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="onboarding-actions">
        <a className="btn btn-ghost" href={onboardingHref("basics", next)}>
          Back
        </a>
        <OnboardingSkipStep
          next={next}
          advanceStep="interests"
          to="interests"
          extra={{ personaIds }}
        />
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Please Wait" : "Continue"}
        </button>
      </div>
    </form>
  );
}
