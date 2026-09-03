"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveOnboardingProfile } from "@/lib/onboarding-client";
import { onboardingHref } from "@/lib/onboarding-shared";
import type { MemberProfile, ProfileCatalog } from "@/lib/profile-shared";

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
    if (personaIds.length === 0) {
      setError("Pick at least one way you usually go out.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      await saveOnboardingProfile({ personaIds });
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
      <h1>How You Go Out</h1>
      <p className="lede muted">
        Solo, with a partner, family, friends, or work — pick the situations that fit. Up to 8.
      </p>
      <div className="tag-picker">
        {catalog.personas.map((persona) => {
          const on = personaIds.includes(persona.id);
          return (
            <button
              key={persona.id}
              type="button"
              className={`chip${on ? " on" : ""}`}
              onClick={() => setPersonaIds(toggleId(personaIds, persona.id, 8))}
            >
              {persona.title}
            </button>
          );
        })}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="onboarding-actions">
        <a className="btn btn-ghost" href={onboardingHref("basics", next)}>
          Back
        </a>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Please Wait" : "Continue"}
        </button>
      </div>
    </form>
  );
}
