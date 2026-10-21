"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MAX_INTERESTS,
  onboardingStepFor,
  type MemberProfile,
  type ProfileCatalog,
} from "@/lib/profile-shared";

function toggleId(ids: string[], id: string, max: number) {
  if (ids.includes(id)) return ids.filter((item) => item !== id);
  if (ids.length >= max) return ids;
  return [...ids, id];
}

function kindClass(kindKey: string) {
  return `kind kind-${kindKey}`;
}

export function InterestsForm({
  profile,
  catalog,
}: {
  profile: MemberProfile;
  catalog: ProfileCatalog;
}) {
  const router = useRouter();
  const [interestIds, setInterestIds] = useState(profile.interestIds);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const visibleInterests = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = needle
      ? catalog.interests.filter((item) => item.title.toLowerCase().includes(needle))
      : catalog.interests;
    const groups = new Map<string, { key: string; title: string; items: typeof rows }>();
    for (const item of rows) {
      const existing = groups.get(item.kind_key);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.set(item.kind_key, {
          key: item.kind_key,
          title: item.kind_title,
          items: [item],
        });
      }
    }
    return [...groups.values()];
  }, [catalog.interests, query]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setPending(true);
    const finishOnboarding =
      onboardingStepFor({
        firstName: profile.firstName,
        homePlaceId: profile.homePlaceId,
        personaIds: profile.personaIds,
        interestIds,
        energyLow: profile.energyLow,
        energyHigh: profile.energyHigh,
      }) === "complete";
    const response = await fetch("/api/account/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interestIds, finishOnboarding }),
    });
    const payload = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not save your interests.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <p className="muted">
        Pick as many as you like — up to {MAX_INTERESTS}. A handful helps Made For You.
      </p>
      <label className="field">
        <span>Search</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search interests"
          aria-label="Search interests"
        />
      </label>
      {visibleInterests.map((group) => (
        <div key={group.key} className="profile-kind" data-kind={group.key}>
          <p className="eyebrow profile-kind-title">
            <span className="profile-kind-swatch" aria-hidden />
            {group.title}
          </p>
          <div className="tag-picker">
            {group.items.map((item) => {
              const on = interestIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`chip ${kindClass(item.kind_key)}${on ? " on" : ""}`}
                  onClick={() => setInterestIds(toggleId(interestIds, item.id, MAX_INTERESTS))}
                >
                  {item.title}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {error && <p className="error">{error}</p>}
      {saved && <p className="notice">Saved. The app sees the same interests.</p>}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Please Wait" : "Save Interests"}
      </button>
    </form>
  );
}
