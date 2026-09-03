import { MembershipCheckoutForm } from "@/components/MembershipCheckoutForm";
import { getCurrentUser } from "@/lib/auth";
import { getPayFastStatus } from "@/lib/payfast";
import { redirect } from "next/navigation";

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string; auto?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/join/subscribe");
  if (user.plan === "paid") redirect("/account");

  const params = await searchParams;
  const payfast = getPayFastStatus();

  return (
    <main className="shell">
      {!payfast.configured && (
        <section className="section">
          <p className="notice">
            PayFast is not configured in this environment yet. Add{" "}
            <code>PAYFAST_MERCHANT_ID</code> & <code>PAYFAST_MERCHANT_KEY</code> to enable
            sandbox checkout.
          </p>
        </section>
      )}
      <MembershipCheckoutForm
        autoStart={params.auto === "1" && payfast.configured}
        cancelled={params.cancelled === "1"}
      />
      {payfast.configured && (
        <p className="muted shell" style={{ marginTop: -40, marginBottom: 48 }}>
          Mode: {payfast.mode}. ITN: <code>{payfast.itnPath}</code>
        </p>
      )}
    </main>
  );
}
