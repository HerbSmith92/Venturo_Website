import { AuthForm } from "@/components/AuthForm";
import { CompanionShell } from "@/components/companion/CompanionShell";
import { getCurrentUser } from "@/lib/auth";
import { COMPANION_HOME } from "@/lib/companion";
import { isSupabaseConfigured } from "@/lib/env";
import { redirect } from "next/navigation";

export default async function CompanionLoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(COMPANION_HOME);

  return (
    <CompanionShell signedIn={false}>
      <main className="companion-gate">
        <AuthForm
          mode="login"
          configured={isSupabaseConfigured()}
          next={COMPANION_HOME}
          surface="companion"
        />
      </main>
    </CompanionShell>
  );
}
