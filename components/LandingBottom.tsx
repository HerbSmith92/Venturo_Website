import { ContactCard } from "@/components/ContactCard";
import { getAppStoreLinks, PAID_CADENCE, PAID_PRICE } from "@/lib/brand";

const TICKER = [
  "Activities",
  "Events",
  "Communities",
  "Member Discounts",
  "Explore, Connect, Thrive",
];

const STEPS = [
  {
    n: "01",
    colour: "#45A67F",
    title: "Pick Your Interests",
    body: "Tell us what you like, who you are with, & how much energy you have to spend.",
  },
  {
    n: "02",
    colour: "#FF9E6B",
    title: "Get Your Feed",
    body: "A live directory of activities, events & communities near you — not another endless scroll.",
  },
  {
    n: "03",
    colour: "#7CC3E9",
    title: "Book Your Adventure",
    body: "A free profile books event tickets. Paid unlocks curated discovery & exclusive discounts.",
  },
];

const STORIES = [
  {
    image: "/brand/images/climbing.jpg",
    kicker: "Discover",
    title: "Everything There Is To Do",
    body: "Places to go, people to meet, & quality time worth keeping.",
  },
  {
    image: "/brand/images/art-wine.jpg",
    kicker: "Unlock",
    title: "Exclusive Member Prices",
    body: "Look for the Member Discount mark. Paid members save at listed spots.",
  },
  {
    image: "/brand/images/family.jpg",
    kicker: "Feed",
    title: "Made For Your Mood",
    body: "Interests, persona & energy spent shape what we show you.",
  },
  {
    image: "/brand/images/nightlife.jpg",
    kicker: "Book",
    title: "Start On Free",
    body: "A free profile is enough to book event tickets. Paid is the rest.",
  },
];

export function LandingBottom() {
  const stores = getAppStoreLinks();

  return (
    <>
      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          {[...TICKER, ...TICKER, ...TICKER].map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      </div>

      <section className="band band-light">
        <div className="shell">
          <div className="band-intro">
            <div>
              <p className="eyebrow">How It Works</p>
              <h2>Less Scrolling. More Doing.</h2>
            </div>
            <p className="lede">
              Venturo is how curious locals find the next plan — without the
              group chat spiral.
            </p>
          </div>
          <div className="step-grid">
            {STEPS.map((step) => (
              <article
                key={step.n}
                className="step"
                style={{ background: step.colour }}
              >
                <span className="step-num">{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="band">
        <div className="shell">
          <div className="band-intro">
            <div>
              <p className="eyebrow">Why People Join</p>
              <h2>
                Four Reasons To <span className="accent">Tap Download</span>
              </h2>
            </div>
            <a className="btn btn-primary" href="/signup">
              Sign Up Free
            </a>
          </div>
          <div className="story-grid">
            {STORIES.map((story) => (
              <article key={story.kicker} className="story">
                <img src={story.image} alt="" />
                <div className="story-copy">
                  <p className="eyebrow">{story.kicker}</p>
                  <h3>{story.title}</h3>
                  <p>{story.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="band band-velvet" id="paid">
        <div className="shell membership">
          <div>
            <p className="eyebrow">Plans That Fit Your Life</p>
            <h2>
              Get The App &amp; <span className="accent">The Deals</span>
            </h2>
            <p className="lede">
              Free creates a profile so you can book event tickets. Paid is{" "}
              {PAID_PRICE} a month in the Venturo app. This website checks
              RevenueCat — we do not take card payments here.
            </p>
            <div className="hero-actions">
              {stores.appStoreReady ? (
                <a className="btn btn-primary" href={stores.appStore}>
                  App Store
                </a>
              ) : (
                <a className="btn btn-primary" href="/join#paid">
                  App Store — Link Soon
                </a>
              )}
              {stores.playStoreReady ? (
                <a className="btn btn-secondary" href={stores.playStore}>
                  Play Store
                </a>
              ) : (
                <a className="btn btn-secondary" href="/join#paid">
                  Play Store — Link Soon
                </a>
              )}
            </div>
          </div>
          <article className="price-card">
            <p className="eyebrow">Paid Membership</p>
            <p className="price-amount">{PAID_PRICE}</p>
            <p className="price-cadence">{PAID_CADENCE}</p>
            <ul>
              <li>Curated discovery & personal recommendations</li>
              <li>Exclusive member discounts</li>
              <li>Confirmed after App Store or Play Store payment</li>
            </ul>
            <a className="btn btn-primary" href="/join#paid">
              Get Paid In The App
            </a>
          </article>
        </div>
      </section>

      <section className="band">
        <div className="shell">
          <div className="biz-split">
            <div className="biz-copy">
              <p className="eyebrow" style={{ color: "var(--orange)" }}>
                For Businesses
              </p>
              <h2>Let&apos;s Put Your Business On The Map</h2>
              <p className="lede">
                Be found by people already hunting for a plan. One brand, every
                branch — hours, prices & photos per location. We prompt the
                member offer, & you stay in control.
              </p>
              <a className="btn btn-primary" href="#contact">
                List Your Business
              </a>
            </div>
            <div className="biz-mark" aria-hidden="true">
              <img
                src="/brand/logos/venturo-horizontal-dark.svg"
                alt=""
              />
            </div>
          </div>
        </div>
      </section>

      <section className="band band-light" id="contact">
        <div className="shell contact-layout">
          <div>
            <p className="eyebrow">Say Hello</p>
            <h2>
              What Are We <span className="accent">Planning?</span>
            </h2>
            <p className="lede">
              People — ask us anything. Businesses — tell us where you are & we
              will help you list.
            </p>
          </div>
          <ContactCard />
        </div>
      </section>
    </>
  );
}
