"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MAX_PERSONAS,
  onboardingStepFor,
  type MemberProfile,
  type ProfileCatalog,
} from "@/lib/profile-shared";

function toggleId(ids: string[], id: string, max: number) {
  if (ids.includes(id)) return ids.filter((item) => item !== id);
  if (ids.length >= max) return ids;
  return [...ids, id];
}

export function GoingOutForm({
  profile,
  catalog,
}: {
  profile: MemberProfile;
  catalog: ProfileCatalog;
}) {
  const router = useRouter();
  const [personaIds, setPersonaIds] = useState(profile.personaIds);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setPending(true);
    const finishOnboarding =
      onboardingStepFor({
        firstName: profile.firstName,
        homePlaceId: profile.homePlaceId,
        personaIds,
        interestIds: profile.interestIds,
        energyLow: profile.energyLow,
        energyHigh: profile.energyHigh,
      }) === "complete";
    const response = await fetch("/api/account/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personaIds, finishOnboarding }),
    });
    const payload = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not save how you go out.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <p className="muted">
        Choose the situations that fit you—solo, with a partner, family, friends, or work. Skip any
        that don’t.
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
      {saved && <p className="notice">Saved. The app sees the same going out.</p>}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Please Wait" : "Save Going Out"}
      </button>
    </form>
  );
}
