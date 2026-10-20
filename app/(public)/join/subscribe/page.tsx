import { MembershipCheckoutForm } from "@/components/MembershipCheckoutForm";
import { getCurrentUser } from "@/lib/auth";
import { getPaystackStatus } from "@/lib/paystack";
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
  const paystack = getPaystackStatus();

  return (
    <main className="shell">
      {!paystack.configured && (
        <section className="section">
          <p className="notice">
            Paystack is not configured in this environment yet. Add{" "}
            <code>PAYSTACK_SECRET_KEY</code> to enable test checkout.
          </p>
        </section>
      )}
      <MembershipCheckoutForm
        autoStart={params.auto === "1" && paystack.configured}
        cancelled={params.cancelled === "1"}
      />
    </main>
  );
}
