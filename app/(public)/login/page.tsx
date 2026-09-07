import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNextPath } from "@/lib/member-auth";
import { memberPostAuthPath, readOnboardingPlan } from "@/lib/onboarding";
import { loadMemberProfile } from "@/lib/profile";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const user = await getCurrentUser();
  if (user) {
    const [profile, plan] = await Promise.all([
      loadMemberProfile(user.id),
      readOnboardingPlan(),
    ]);
    redirect(
      memberPostAuthPath({
        role: user.role,
        profile,
        plan,
        paid: user.plan === "paid",
        requestedNext: next,
      }),
    );
  }

  return (
    <main className="shell">
      <AuthForm
        mode="login"
        configured={isSupabaseConfigured()}
        next={next}
        initialError={params.error?.trim() || null}
      />
    </main>
  );
}
