import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function CheckoutReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { slug } = await params;
  const { order } = await searchParams;
  if (!order) redirect(`/events/${slug}`);

  const supabase = await createClient();
  if (supabase) {
    const { data } = await supabase
      .from("event_orders")
      .select("id, status, buyer_id")
      .eq("id", order)
      .maybeSingle();

    if (data?.buyer_id === user.id && data.status === "paid") {
      redirect(`/account/tickets?order=${order}`);
    }
  }

  return (
    <main className="shell">
      <section className="section">
        <p className="eyebrow">Payment</p>
        <h1>We&apos;re Confirming Your Payment</h1>
        <p className="lede muted">
          PayFast is notifying us. This usually takes a few seconds. Refresh your
          tickets shortly — or open them from your account.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="/account/tickets">
            My Tickets
          </a>
          <a className="btn btn-secondary" href={`/events/${slug}`}>
            Back To Event
          </a>
        </div>
      </section>
    </main>
  );
}
