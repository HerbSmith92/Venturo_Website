import type { ReactNode } from "react";
import type { OnboardingPlan, OnboardingStepId } from "@/lib/onboarding-shared";
import { onboardingHref, stepsForPlan } from "@/lib/onboarding-shared";

const LABELS: Record<OnboardingStepId, string> = {
  plan: "Plan",
  basics: "Basics",
  personas: "How You Go",
  interests: "Interests",
  energy: "Energy",
  confirm: "Confirm",
};

export function OnboardingFrame({
  step,
  plan,
  next,
  wide,
  children,
}: {
  step: OnboardingStepId;
  plan: OnboardingPlan | null;
  next?: string | null;
  wide?: boolean;
  children: ReactNode;
}) {
  const steps = stepsForPlan(plan === "free" || plan === "subscribe" ? plan : null);
  const index = Math.max(steps.indexOf(step), 0);
  const total = Math.max(steps.length, 1);

  return (
    <main className="shell">
      <section className={`onboarding-card${wide ? " wide" : ""}`}>
        <div className="onboarding-progress" aria-label="Onboarding progress">
          <p className="onboarding-progress-count">
            Step {Math.min(index + 1, total)} of {total}
          </p>
          <div className="onboarding-progress-bar">
            <span style={{ width: `${((index + 1) / total) * 100}%` }} />
          </div>
          <ol className="onboarding-progress-steps">
            {steps.map((item) => (
              <li key={item} className={item === step ? "current" : index > steps.indexOf(item) ? "done" : ""}>
                {index > steps.indexOf(item) ? (
                  <a href={onboardingHref(item, next)}>{LABELS[item]}</a>
                ) : (
                  LABELS[item]
                )}
              </li>
            ))}
          </ol>
        </div>
        {children}
      </section>
    </main>
  );
}
