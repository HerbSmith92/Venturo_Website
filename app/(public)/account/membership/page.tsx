import { getCurrentUser } from "@/lib/auth";
import { PAID_PRICE } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function membershipCopy(row: {
  subscribed: boolean;
  payfast_active: boolean;
  revenuecat_active: boolean;
  current_period_end: string | null;
} | null) {
  const paid = Boolean(row?.subscribed);
  const end = row?.current_period_end ? new Date(row.current_period_end) : null;
  const endMs = end?.getTime() ?? NaN;
  const future = Number.isFinite(endMs) && endMs > Date.now();
  const until = end && Number.isFinite(endMs) ? end.toLocaleDateString("en-ZA") : null;
  const website = Boolean(row?.payfast_active);
  const app = Boolean(row?.revenuecat_active);
  const provider = website ? "Website · Paystack" : app ? "App Store or Google Play" : "None yet";

  if (paid && future) {
    return {
      paid,
      status: "Active",
      provider,
      dateLine: `Renews ${until}`,
      website,
      app,
    };
  }
  if (paid && until && !future) {
    return {
      paid,
      status: "Active",
      provider,
      dateLine: `Access recorded until ${until}. That date is in the past — check the store or website billing below if you expected a later renewal.`,
      website,
      app,
    };
  }
  if (!paid && future) {
    return {
      paid,
      status: "Cancelled but still valid",
      provider,
      dateLine: `Access until ${until}`,
      website,
      app,
    };
  }
  return {
    paid,
    status: "Free",
    provider,
    dateLine: until ? `Last recorded period ended ${until}` : null,
    website,
    app,
  };
}

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
  const copy = membershipCopy(
    data as {
      subscribed: boolean;
      payfast_active: boolean;
      revenuecat_active: boolean;
      current_period_end: string | null;
    } | null,
  );

  return (
    <>
        <p className="eyebrow">My Venturo</p>
        <h1>Membership</h1>
        <p className="lede">
          {copy.status}. {PAID_PRICE} a month unlocks Made For You &amp; member prices. Subscribe here, or in the app.
        </p>
        <ul>
          <li>Status: {copy.status}</li>
          <li>Billing: {copy.provider}</li>
          {copy.dateLine ? <li>{copy.dateLine}</li> : null}
        </ul>
        <div className="hero-actions">
          {copy.paid ? (
            <a className="btn btn-primary" href="/account">
              Your Account
            </a>
          ) : (
            <a className="btn btn-primary" href="/join/subscribe">
              Subscribe · {PAID_PRICE} / month
            </a>
          )}
          {copy.website ? (
            <a className="btn btn-secondary" href="/join/subscribe">
              Manage website billing
            </a>
          ) : null}
          {copy.app ? (
            <>
              <a className="btn btn-secondary" href="https://apps.apple.com/account/subscriptions">
                Manage on Apple
              </a>
              <a className="btn btn-secondary" href="https://play.google.com/store/account/subscriptions">
                Manage on Google Play
              </a>
            </>
          ) : null}
          <a className="btn btn-secondary" href="/help">
            Payment Help
          </a>
        </div>
        <p className="muted" style={{ marginTop: 16 }}>
          The website &amp; the app read the same membership. App billing is through Apple or Google — Venturo cannot cancel a store subscription from this page.
        </p>
    </>
  );
}
