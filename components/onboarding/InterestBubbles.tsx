"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingSkipStep } from "@/components/onboarding/OnboardingSkip";
import { VeeTile } from "@/components/onboarding/VeeTile";
import { saveOnboardingProfile } from "@/lib/onboarding-client";
import { onboardingHref } from "@/lib/onboarding-shared";
import { MAX_INTERESTS, type MemberProfile, type ProfileCatalog } from "@/lib/profile-shared";
import { HUB_ORDER, hubLook } from "@/lib/vee-avatars";

function toggleHub(ids: string[], itemIds: string[], max: number) {
  const on = itemIds.some((id) => ids.includes(id));
  if (on) return ids.filter((id) => !itemIds.includes(id));
  const next = [...ids];
  for (const id of itemIds) {
    if (next.length >= max) break;
    if (!next.includes(id)) next.push(id);
  }
  return next;
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
    const rows = [...groups.values()];
    return rows.sort((a, b) => {
      const aIndex = HUB_ORDER.indexOf(a.key);
      const bIndex = HUB_ORDER.indexOf(b.key);
      return (aIndex === -1 ? HUB_ORDER.length : aIndex) - (bIndex === -1 ? HUB_ORDER.length : bIndex);
    });
  }, [catalog.interests]);

  const selected = new Set(interestIds);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await saveOnboardingProfile({ interestIds, advanceStep: "activity_scale" });
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
        Pick every world that fits. Vee comes along for the ride. Skip if you want to choose later.
      </p>
      <div className="vee-grid hubs">
        {hubs.map((hub) => {
          const itemIds = hub.items.map((item) => item.id);
          const on = itemIds.some((id) => selected.has(id));
          return (
            <VeeTile
              key={hub.key}
              title={hub.title}
              look={hubLook(hub.key)}
              pressed={on}
              onClick={() => setInterestIds(toggleHub(interestIds, itemIds, MAX_INTERESTS))}
            />
          );
        })}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="onboarding-actions">
        <a className="btn btn-ghost" href={onboardingHref("personas", next)}>
          Back
        </a>
        <OnboardingSkipStep
          next={next}
          advanceStep="activity_scale"
          to="energy"
          extra={{ interestIds }}
        />
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Please Wait" : "Continue"}
        </button>
      </div>
    </form>
  );
}
