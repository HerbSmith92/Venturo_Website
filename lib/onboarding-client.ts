import { destinationAfterOnboarding } from "@/lib/onboarding-shared";

export async function saveOnboardingProfile(body: Record<string, unknown>) {
  const response = await fetch("/api/account/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { error?: string; onboardingStep?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Could not save your profile.");
  }
  return payload;
}

export async function saveOnboardingPlan(plan: "free" | "subscribe") {
  const response = await fetch("/api/onboarding/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Could not save that plan.");
  }
}

export async function skipOnboarding(next?: string | null) {
  await saveOnboardingPlan("free");
  await saveOnboardingProfile({ plan: "free", finishOnboarding: true });
  window.location.href = destinationAfterOnboarding(next, "free");
}
