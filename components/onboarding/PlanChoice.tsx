"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PAID_PRICE } from "@/lib/brand";
import { saveOnboardingPlan } from "@/lib/onboarding-client";
import { onboardingHref, type OnboardingPlan } from "@/lib/onboarding-shared";

export function PlanChoice({
  plan,
  next,
  paid,
}: {
  plan: OnboardingPlan | null;
  next?: string | null;
  paid: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<OnboardingPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(nextPlan: OnboardingPlan) {
    setError(null);
    setPending(nextPlan);
    try {
      await saveOnboardingPlan(nextPlan);
      router.push(onboardingHref("basics", next));
      router.refresh();
    } catch (caught) {
      setPending(null);
      setError(caught instanceof Error ? caught.message : "Could not save that plan.");
    }
  }

  return (
    <>
      <p className="eyebrow">Join Venturo</p>
      <h1>How Do You Want To Explore?</h1>
      <p className="lede muted">
        Start free, or subscribe for Made For You & member prices. You can upgrade later.
      </p>
      {paid && (
        <p className="notice">
          You already have a paid membership. We’ll still get to know you so Made For You works.
        </p>
      )}
      <div className="plans onboarding-plans">
        <article className={`plan${plan === "free" ? " featured" : ""}`}>
          <p className="eyebrow" style={{ color: "var(--sapphire)" }}>
            Free
          </p>
          <h2>Start Free</h2>
          <p className="muted">R 0 · forever</p>
          <ul>
            <li>Browse the directory taste</li>
            <li>Book tickets to events</li>
            <li>Keep a simple profile</li>
          </ul>
          <p className="muted">A short confirm — name & home area. Tell us more later if you like.</p>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={Boolean(pending)}
            onClick={() => void choose("free")}
          >
            {pending === "free" ? "Please Wait" : plan === "free" ? "Continue Free" : "Start Free"}
          </button>
        </article>
        <article className={`plan featured`}>
          <p className="eyebrow" style={{ color: "var(--canary)" }}>
            Subscribe
          </p>
          <h2>Explore More</h2>
          <p>
            {PAID_PRICE} per month
          </p>
          <ul>
            <li>Curated discovery & personal recommendations</li>
            <li>Exclusive member discounts</li>
            <li>Same profile on the website & the app</li>
          </ul>
          <p className="muted">We’ll get to know how you go out, what you love, & the energy you’re bringing.</p>
          <button
            className="btn btn-primary"
            type="button"
            disabled={Boolean(pending)}
            onClick={() => void choose("subscribe")}
          >
            {pending === "subscribe"
              ? "Please Wait"
              : `Explore More From ${PAID_PRICE}`}
          </button>
        </article>
      </div>
      {error && <p className="error">{error}</p>}
    </>
  );
}
