import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { PORTAL_HOME } from "@/lib/portal";
import { redirect } from "next/navigation";

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ join?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(PORTAL_HOME);

  const params = await searchParams;
  const join = params.join === "1";

  return (
    <main className="portal-gate">
      <AuthForm
        mode={join ? "signup" : "login"}
        configured={isSupabaseConfigured()}
        next={PORTAL_HOME}
        surface="portal"
        initialError={params.error?.trim() || null}
      />
    </main>
  );
}
