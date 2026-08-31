"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MAX_INTERESTS,
  MIN_INTERESTS,
  type MemberProfile,
  type ProfileCatalog,
} from "@/lib/profile-shared";

function toggleId(ids: string[], id: string, max: number) {
  if (ids.includes(id)) return ids.filter((item) => item !== id);
  if (ids.length >= max) return ids;
  return [...ids, id];
}

export function ProfileForm({
  profile,
  catalog,
}: {
  profile: MemberProfile;
  catalog: ProfileCatalog;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [homePlaceId, setHomePlaceId] = useState(profile.homePlaceId ?? "");
  const [personaIds, setPersonaIds] = useState(profile.personaIds);
  const [interestIds, setInterestIds] = useState(profile.interestIds);
  const [energyLow, setEnergyLow] = useState(profile.energyLow != null ? String(profile.energyLow) : "");
  const [energyHigh, setEnergyHigh] = useState(profile.energyHigh != null ? String(profile.energyHigh) : "");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
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

  const visibleInterests = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = needle
      ? catalog.interests.filter((item) => item.title.toLowerCase().includes(needle))
      : catalog.interests;
    const groups = new Map<string, typeof rows>();
    for (const item of rows) {
      const list = groups.get(item.kind_title) ?? [];
      list.push(item);
      groups.set(item.kind_title, list);
    }
    return [...groups.entries()];
  }, [catalog.interests, query]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setPending(true);
    const response = await fetch("/api/account/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName,
        homePlaceId: homePlaceId || null,
        personaIds,
        interestIds,
        energyLow: energyLow ? Number(energyLow) : null,
        energyHigh: energyHigh ? Number(energyHigh) : null,
      }),
    });
    const payload = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not save your profile.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form className="profile-form" onSubmit={onSubmit}>
      <label className="field">
        <span>First Name</span>
        <input
          name="displayName"
          type="text"
          autoComplete="given-name"
          required
          maxLength={80}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </label>

      <label className="field">
        <span>Home Area</span>
        <select value={homePlaceId} onChange={(e) => setHomePlaceId(e.target.value)}>
          <option value="">Pick a place</option>
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

      <fieldset className="radio-set">
        <legend>Persona</legend>
        <p className="muted" style={{ marginTop: 0 }}>
          Who you show up as. Same tags as the app.
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
      </fieldset>

      <div className="field">
        <span>Interests</span>
        <p className="muted">
          Pick at least {MIN_INTERESTS} when you can — skip is fine. Max {MAX_INTERESTS}.
        </p>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search interests"
          aria-label="Search interests"
        />
        {visibleInterests.map(([kind, items]) => (
          <div key={kind} className="profile-kind">
            <p className="eyebrow">{kind}</p>
            <div className="tag-picker">
              {items.map((item) => {
                const on = interestIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`chip${on ? " on" : ""}`}
                    onClick={() => setInterestIds(toggleId(interestIds, item.id, MAX_INTERESTS))}
                  >
                    {item.title}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="field-row">
        <label className="field">
          <span>Energy From</span>
          <select value={energyLow} onChange={(e) => setEnergyLow(e.target.value)}>
            <option value="">Not set yet</option>
            {catalog.scales.map((scale) => (
              <option key={scale.rank} value={scale.rank}>
                {scale.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Energy To</span>
          <select value={energyHigh} onChange={(e) => setEnergyHigh(e.target.value)}>
            <option value="">Not set yet</option>
            {catalog.scales.map((scale) => (
              <option key={scale.rank} value={scale.rank}>
                {scale.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted">
        Current mood, not a life sentence. Change it whenever the week shifts.
      </p>

      {error && <p className="error">{error}</p>}
      {saved && <p className="notice">Saved. The app sees the same profile.</p>}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Please Wait" : "Save Profile"}
      </button>
    </form>
  );
}
