export function LandingHero() {
  return (
    <section className="band band-night hero-band">
      <div className="shell split-hero">
        <div className="split-hero-copy">
          <p className="eyebrow">Activities · Events · Community</p>
          <h1>
            Your Next <span className="accent">Adventure</span> Awaits
          </h1>
          <p className="lede">
            Find things to do, events & communities near you. Taste the
            directory, then join free — or go paid in the app for deals made
            for your mood.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="/directory">
              Start Exploring
            </a>
            <a className="btn btn-secondary" href="#how-it-works">
              How It Works
            </a>
          </div>
        </div>
        <div className="hero-orb" aria-hidden="true">
          <img
            className="hero-phone"
            src="/brand/app/screen-foryou.png"
            alt=""
          />
        </div>
      </div>
    </section>
  );
}

export function CategoryTicker() {
  const items = [
    "Activities",
    "Events",
    "Communities",
    "Directory",
    "Membership",
  ];
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-row">
        {items.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </div>
  );
}
