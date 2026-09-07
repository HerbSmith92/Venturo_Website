import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { formatCents, getPlatformFees } from "@/lib/events";
import { PORTAL_HOME, portalLoginHref } from "@/lib/portal";

export const metadata: Metadata = {
  title: "Event Host · Venturo",
  description:
    "Put your event in front of curious locals already looking for a plan. Tickets on PayFast. Same Venturo account, quiet Event Host space.",
};

const REASONS = [
  {
    n: "01",
    colour: "#45A67F",
    title: "People Already Looking",
    body: "Your event sits next to the directory, the app feed, & What's On. Curious locals are already hunting a plan—you are not shouting into an empty ticket site.",
  },
  {
    n: "02",
    colour: "#FF9E6B",
    title: "Tickets Without The Circus",
    body: "PayFast in rand. Member prices if you want to look after subscribers. A quiet Event Host space—the public site stays outside until you leave.",
  },
  {
    n: "03",
    colour: "#5E589E",
    title: "A Calendar Worth Opening",
    body: "Member hosts get a quick yes from our team. What's On stays real plans—hikes, nights out, workshops—not a junk drawer of listings.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Open Event Host",
    body: "Same Venturo account as the site & app. This space is just for hosting & tickets.",
  },
  {
    n: "02",
    title: "Build The Event",
    body: "Name, when, where, & tickets. Bank for payouts lives in Host Settings—once, not per event.",
  },
  {
    n: "03",
    title: "We Check, Then Live",
    body: "A Control Room yes, then curious locals can book. Free profiles already buy tickets.",
  },
];

export default async function EventHostPage() {
  const [user, fees] = await Promise.all([getCurrentUser(), getPlatformFees()]);

  const feeBits = [
    fees.commissionPct > 0 ? `${fees.commissionPct}% commission` : null,
    fees.bookingFeeCents > 0
      ? `${formatCents(fees.bookingFeeCents)} booking fee`
      : null,
  ].filter(Boolean);
  const feeNote =
    feeBits.length === 0
      ? "Platform fees are R 0.00 right now—you keep the ticket total."
      : `From your payout we take ${feeBits.join(" & ")}. Buyers still pay the ticket price.`;

  const enterHref = PORTAL_HOME;
  const joinHref = portalLoginHref(true);

  return (
    <main>
      <section className="shell">
        <div className="hero">
          <img src="/brand/images/nightlife.jpg" alt="" />
          <div className="hero-copy">
            <p className="eyebrow">Event Host</p>
            <h1>Your Event. Their Next Adventure.</h1>
            <p className="lede">
              Curious locals already use Venturo to find things to do. Host with
              us &amp; your night, hike, or workshop lands where they are
              looking—then they book.
            </p>
            <div className="hero-actions">
              {user ? (
                <a className="btn btn-primary" href={enterHref}>
                  Open Event Host
                </a>
              ) : (
                <>
                  <a className="btn btn-primary" href={joinHref}>
                    Join As A Host
                  </a>
                  <a className="btn btn-secondary" href={enterHref}>
                    Log In To Host
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="section shell">
        <div className="section-head">
          <div>
            <p className="eyebrow">Why Host With Us</p>
            <h2>Not Another Ticket Island</h2>
            <p className="muted" style={{ maxWidth: "46ch" }}>
              Tickets matter. The crowd matters more. Venturo is activities,
              events, &amp; community—so your plan sits with people who came
              to do something, not to scroll a marketplace.
            </p>
          </div>
        </div>
        <div className="step-grid host-reasons">
          {REASONS.map((reason) => (
            <article
              key={reason.n}
              className="step"
              style={{ background: reason.colour }}
            >
              <span className="step-num">{reason.n}</span>
              <h3>{reason.title}</h3>
              <p>{reason.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="band band-light">
        <div className="shell">
          <div className="band-intro">
            <div>
              <p className="eyebrow">How It Works</p>
              <h2>Three Moves. Then You&apos;re Live.</h2>
            </div>
            <p className="lede">
              We keep the host side quiet on purpose. The public site is for
              guests. Event Host is for you.
            </p>
          </div>
          <ol className="how-host">
            {STEPS.map((step) => (
              <li key={step.n}>
                <span>{step.n}</span>
                <strong>{step.title}</strong>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="band">
        <div className="shell events-host-close">
          <p className="eyebrow">Event Host</p>
          <h2>Ready When You Are</h2>
          <p className="lede muted">
            Same account. Separate space. Leave Event Host whenever you want
            the public site back.
          </p>
          <div className="hero-actions">
            {user ? (
              <a className="btn btn-primary" href={enterHref}>
                Open Event Host
              </a>
            ) : (
              <>
                <a className="btn btn-primary" href={joinHref}>
                  Join As A Host
                </a>
                <a className="btn btn-secondary" href={enterHref}>
                  Log In To Host
                </a>
              </>
            )}
          </div>
          <p className="muted events-host-fees">{feeNote}</p>
        </div>
      </section>
    </main>
  );
}
