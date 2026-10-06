import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { portalReturnPath } from "@/lib/portal";
import { redirect } from "next/navigation";

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ join?: string; error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = portalReturnPath(params.next);
  const user = await getCurrentUser();
  if (user) redirect(next);

  const join = params.join === "1";

  return (
    <main className="portal-gate">
      <AuthForm
        mode={join ? "signup" : "login"}
        configured={isSupabaseConfigured()}
        next={next}
        surface="portal"
        initialError={params.error?.trim() || null}
      />
    </main>
  );
}
