import { getCurrentUser } from "@/lib/auth";
import { loadMembershipForUser } from "@/lib/memberships";
import { redirect } from "next/navigation";

export default async function SubscribeReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ membership?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/join/subscribe");

  const { membership: membershipId } = await searchParams;
  if (!membershipId) redirect("/join/subscribe");

  const row = await loadMembershipForUser(user.id, membershipId);
  if (row?.status === "active" || user.plan === "paid") {
    redirect("/account");
  }

  return (
    <main className="shell">
      <section className="section">
        <p className="eyebrow">Payment</p>
        <h1>We&apos;re Confirming Your Membership</h1>
        <p className="lede muted">
          PayFast is notifying us. This usually takes a few seconds. Refresh shortly — or open
          your profile to see if Paid is on.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="/account">
            Your Profile
          </a>
          <a className="btn btn-secondary" href={`/join/subscribe/return?membership=${membershipId}`}>
            Refresh Status
          </a>
        </div>
      </section>
    </main>
  );
}
