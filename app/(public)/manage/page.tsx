import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { redirect } from "next/navigation";

export default async function ActivityManagerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/manage");

  const staff = isStaff(user.role);
  const business = user.role === "business";

  return (
    <main className="shell">
      <section className="section">
        <p className="eyebrow">Activity Manager</p>
        <h1>Capture & Edit Listings</h1>
        <p className="lede muted">
          Editors & claimed businesses keep the directory honest — branches,
          hours, prices, & member discounts. Publish still goes through Control
          Room.
        </p>

        {staff ? (
          <div className="plan featured" style={{ marginTop: 24 }}>
            <h3>Staff Shortcut</h3>
            <p className="muted">
              Full listing editor lives in Control Room today. Activity Manager
              steps (7-step wizard for businesses) expand from here.
            </p>
            <div className="hero-actions" style={{ marginTop: 16 }}>
              <a className="btn btn-primary" href="/admin/listings">
                Open Control Room Directory
              </a>
              <a className="btn btn-secondary" href="/directory/claim">
                Business Claim Flow
              </a>
            </div>
          </div>
        ) : business ? (
          <div className="plan featured" style={{ marginTop: 24 }}>
            <h3>Your Claimed Spots</h3>
            <p className="muted">
              Once Control Room verifies your business role, you&apos;ll edit
              only your organisation here. Branch hours, activities, & member
              prices — then Submit To Review.
            </p>
            <div className="hero-actions" style={{ marginTop: 16 }}>
              <a className="btn btn-primary" href="/directory/claim">
                Claim A Listing
              </a>
              <a className="btn btn-secondary" href="/directory">
                Browse Directory
              </a>
            </div>
          </div>
        ) : (
          <div className="plan" style={{ marginTop: 24 }}>
            <h3>Not A Business Account Yet</h3>
            <p className="muted">
              Start with Claim Your Listing. Control Room verifies you, then
              this workspace unlocks for your branches only.
            </p>
            <div className="hero-actions" style={{ marginTop: 16 }}>
              <a className="btn btn-primary" href="/directory/claim">
                Claim Your Listing
              </a>
              <a className="btn btn-secondary" href="/events/create">
                Host An Event Instead
              </a>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
