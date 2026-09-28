import { AccountNav } from "@/components/AccountNav";
import { getCurrentUser } from "@/lib/auth";
import { PAID_PRICE } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function MembershipPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/membership");
  const supabase = await createClient();
  const { data } = supabase
    ? await supabase
        .from("member_access")
        .select("subscribed, payfast_active, revenuecat_active, current_period_end")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };
  const row = data as {
    subscribed: boolean;
    payfast_active: boolean;
    revenuecat_active: boolean;
    current_period_end: string | null;
  } | null;
  const paid = Boolean(row?.subscribed);
  const provider = row?.payfast_active
    ? "Website · PayFast"
    : row?.revenuecat_active
      ? "App · Apple or Google"
      : "None yet";
  const until = row?.current_period_end
    ? new Date(row.current_period_end).toLocaleDateString("en-ZA")
    : null;
  const status = paid ? "Active" : until && new Date(row?.current_period_end ?? "").getTime() > Date.now()
    ? "Cancelled but still valid"
    : "Free";

  return (
    <main className="shell">
      <section className="section">
        <AccountNav current="membership" />
        <p className="eyebrow">My Venturo</p>
        <h1>Membership</h1>
        <p className="lede">
          {status}. {PAID_PRICE} a month unlocks Made For You and member prices. The app reads this
          same access.
        </p>
        <ul>
          <li>Status: {status}</li>
          <li>Billing: {provider}</li>
          {until ? <li>Renewal or end: {until}</li> : null}
        </ul>
        <div className="hero-actions">
          <a className="btn btn-primary" href="/join/subscribe">
            {paid ? "Manage On The Website" : "Subscribe With PayFast"}
          </a>
          <a className="btn btn-secondary" href="/help">
            Payment Help
          </a>
        </div>
        <p className="muted" style={{ marginTop: 16 }}>
          App Store and Play Store purchases are restored in the app. They write the same membership
          row.
        </p>
      </section>
    </main>
  );
}
