import type { Metadata } from "next";
import { loadWebsiteCopy } from "@/lib/website";

export const metadata: Metadata = {
  title: "Support · Venturo",
};

const TOPICS = [
  { href: "/account/tickets", title: "Tickets", body: "Open Tickets in My Venturo for upcoming & past adventures, keepsakes & event links." },
  { href: "/refunds", title: "Refunds", body: "Ticket refunds follow the Refund Policy. Host payouts sit in Event Host Payment." },
  { href: "/login", title: "Account codes", body: "Website login is a one-time email code. Check spam if it is slow, then try again." },
  { href: "/account/membership", title: "Memberships", body: "Website billing is Paystack. App billing is Apple or Google. Cancel in the store that charged you." },
  { href: "/directory", title: "Member prices", body: "Signed-in paid members see member prices on the website. Some partners still redeem in the app." },
  { href: "/portal", title: "Hosts", body: "Create or manage events in Event Host. Companion is the door tool on the night." },
  { href: "/directory/claim", title: "Claims", body: "Claim an existing listing or tell us if your business is not listed yet. Staff review every request." },
];

export default async function SupportPage() {
  const copy = await loadWebsiteCopy();
  return (
    <main className="shell">
      <section className="section">
        <p className="eyebrow">Here To Help</p>
        <h1>Support</h1>
        <p className="lede" style={{ whiteSpace: "pre-wrap" }}>
          {copy.helpBody}
        </p>
        <div className="stack-list" style={{ marginTop: 28 }}>
          {TOPICS.map((topic) => (
            <article key={topic.href} className="plan">
              <h2>{topic.title}</h2>
              <p className="muted">{topic.body}</p>
              <p style={{ marginTop: 12 }}>
                <a href={topic.href}>Open {topic.title}</a>
              </p>
            </article>
          ))}
        </div>
        <p>
          <a className="btn btn-primary" href={`mailto:${copy.helpEmail}`}>
            {copy.helpEmail}
          </a>
        </p>
        <div className="hero-actions" style={{ marginTop: 24 }}>
          <a className="btn btn-secondary" href={copy.appStoreUrl}>
            App Store
          </a>
          <a className="btn btn-secondary" href={copy.playStoreUrl}>
            Google Play
          </a>
        </div>
      </section>
    </main>
  );
}
