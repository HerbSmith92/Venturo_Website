"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveOnboardingProfile } from "@/lib/onboarding-client";
import { onboardingHref } from "@/lib/onboarding-shared";
import { MAX_INTERESTS, MIN_INTERESTS, type MemberProfile, type ProfileCatalog } from "@/lib/profile-shared";

function toggleId(ids: string[], id: string, max: number) {
  if (ids.includes(id)) return ids.filter((item) => item !== id);
  if (ids.length >= max) return ids;
  return [...ids, id];
}

export function InterestBubbles({
  profile,
  catalog,
  next,
}: {
  profile: MemberProfile;
  catalog: ProfileCatalog;
  next?: string | null;
}) {
  const router = useRouter();
  const [interestIds, setInterestIds] = useState(profile.interestIds);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const hubs = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; title: string; items: ProfileCatalog["interests"] }
    >();
    for (const item of catalog.interests) {
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
  }, [catalog.interests]);

  const selected = new Set(interestIds);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (interestIds.length < MIN_INTERESTS) {
      setError(`Pick at least ${MIN_INTERESTS} interests so Made For You has something to work with.`);
      return;
    }
    setError(null);
    setPending(true);
    try {
      await saveOnboardingProfile({ interestIds });
      router.push(onboardingHref("energy", next));
      router.refresh();
    } catch (caught) {
      setPending(false);
      setError(caught instanceof Error ? caught.message : "Could not save.");
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <p className="eyebrow">Getting To Know You</p>
      <h1>What Pulls You In</h1>
      <p className="lede muted">
        Tap a bubble to open it. Pick at least {MIN_INTERESTS} interests — max {MAX_INTERESTS}.
      </p>
      <p className="onboarding-pick-count">
        {interestIds.length} selected
      </p>
      <div className="bubble-map">
        {hubs.map((hub) => {
          const count = hub.items.filter((item) => selected.has(item.id)).length;
          const open = openKey === hub.key;
          return (
            <div
              key={hub.key}
              className={`bubble-hub-wrap${open ? " open" : ""}${count > 0 ? " lit" : ""}`}
              data-kind={hub.key}
            >
              <button
                type="button"
                className="bubble-hub"
                aria-expanded={open}
                onClick={() => setOpenKey(open ? null : hub.key)}
              >
                <span className="bubble-hub-title">{hub.title}</span>
                <span className="bubble-hub-count">
                  {count > 0 ? `${count} picked` : "Tap to open"}
                </span>
              </button>
              {open && (
                <div className="bubble-spokes">
                  {hub.items.map((item) => {
                    const on = selected.has(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`chip kind kind-${item.kind_key}${on ? " on" : ""}`}
                        onClick={() => setInterestIds(toggleId(interestIds, item.id, MAX_INTERESTS))}
                      >
                        {item.title}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="onboarding-actions">
        <a className="btn btn-ghost" href={onboardingHref("personas", next)}>
          Back
        </a>
        <button
          className="btn btn-primary"
          type="submit"
          disabled={pending || interestIds.length < MIN_INTERESTS}
        >
          {pending ? "Please Wait" : "Continue"}
        </button>
      </div>
    </form>
  );
}
