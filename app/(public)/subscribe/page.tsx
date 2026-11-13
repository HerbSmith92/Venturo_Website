import { APP_STORE_URL, PAID_PRICE, PLAY_STORE_URL } from "@/lib/brand";

const STEPS = [
  {
    title: "Download Venturo",
    body: "Choose the App Store or Google Play.",
  },
  {
    title: "Join In The App",
    body: "Sign in & start your membership.",
  },
  {
    title: "Explore Anywhere",
    body: "Use the same Venturo account on the website.",
  },
];

export const metadata = {
  title: "Subscribe · Venturo",
};

export default function SubscribeInAppPage() {
  return (
    <main className="subscribe-page">
      <section className="subscribe-hero">
        <div className="shell subscribe-hero-grid">
          <div className="subscribe-copy">
            <p className="eyebrow">Venturo Membership</p>
            <h1>
              Unlock Your Next <span>Adventure.</span>
            </h1>
            <p className="subscribe-hero-lead">
              Enjoy member discounts, exclusive events &amp; more reasons to get out there.
            </p>
            <p className="subscribe-price">
              <strong>{PAID_PRICE}</strong>
              <span>/ month</span>
            </p>
            <p className="subscribe-in-app">Subscribe in the Venturo app.</p>
            <div className="store-badges">
              <a href={APP_STORE_URL} target="_blank" rel="noreferrer">
                <img
                  src="/brand/stores/app-store-badge.svg"
                  alt="Download on the App Store"
                  width={120}
                  height={40}
                />
              </a>
              <a href={PLAY_STORE_URL} target="_blank" rel="noreferrer">
                <img
                  className="store-badge-google"
                  src="/brand/stores/google-play-badge.png"
                  alt="Get it on Google Play"
                  width={155}
                  height={60}
                />
              </a>
            </div>
            <p className="subscribe-note">Already have the app? Open Venturo to join.</p>
          </div>

          <div className="subscribe-stage">
            <p className="subscribe-sticker">One Membership. App &amp; Web.</p>
            <img
              src="/brand/vee/adventure.png"
              alt="Vee with a backpack, ready for the next adventure."
              width={480}
              height={480}
            />
          </div>
        </div>
      </section>

      <section className="subscribe-steps">
        <div className="shell">
          <h2>Your Adventure Starts Here.</h2>
          <ol>
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <span>{index + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <aside className="subscribe-same">
            <span aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path
                  fill="currentColor"
                  fillRule="evenodd"
                  d="M12 2.2a9.8 9.8 0 1 0 0 19.6 9.8 9.8 0 0 0 0-19.6Zm0 2a7.8 7.8 0 0 1 4.7 14 6.4 6.4 0 0 0-2.1-2.3 3.3 3.3 0 1 0-5.2 0 6.4 6.4 0 0 0-2.1 2.3 7.8 7.8 0 0 1 4.7-14Z"
                />
                <circle cx="12" cy="10" r="2.1" fill="currentColor" />
              </svg>
            </span>
            <div>
              <h3>Same Account. Same Membership.</h3>
              <p>
                Sign in with the same Venturo account in the app &amp; on the website to access your
                benefits.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
