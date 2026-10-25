import { AuthForm } from "@/components/AuthForm";
import { MembershipCheckoutForm } from "@/components/MembershipCheckoutForm";
import { StoreDownload } from "@/components/StoreDownload";
import { getCurrentUser } from "@/lib/auth";
import { getPaystackStatus } from "@/lib/paystack";
import { isSupabaseConfigured } from "@/lib/env";
import { redirect } from "next/navigation";

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string; auto?: string }>;
}) {
  const user = await getCurrentUser();
  if (user?.plan === "paid") redirect("/account");

  const params = await searchParams;
  const paystack = getPaystackStatus();

  return (
    <main className="shell">
      <section className="section">
        <p className="eyebrow">Subscribe</p>
        <h1>Membership on the website</h1>
        <p className="lede">R 19.99 a month for member prices. The app uses the same account.</p>
        <StoreDownload />
      </section>
      {!user ? (
        <section className="section">
          <h2>Create your profile</h2>
          <p className="muted">One page. Sign up here, then the membership payment opens on this same address.</p>
          <AuthForm mode="signup" configured={isSupabaseConfigured()} next="/join/subscribe" />
        </section>
      ) : (
        <>
          {!paystack.configured && (
            <section className="section">
              <p className="notice">
                Paystack is not configured in this environment yet. Add <code>PAYSTACK_SECRET_KEY</code> to enable test checkout.
              </p>
            </section>
          )}
          <MembershipCheckoutForm
            autoStart={params.auto === "1" && paystack.configured}
            cancelled={params.cancelled === "1"}
          />
        </>
      )}
    </main>
  );
}
