import type { CurrentUser } from "@/lib/auth";
import { SiteHeaderNav } from "@/components/SiteHeaderNav";

export function SiteHeader({ user }: { user: CurrentUser | null }) {
  return (
    <div className="chrome">
      <div className="colour-bar" aria-hidden="true" />
      <header className="site-header shell">
        <a href="/" aria-label="Venturo home">
          <img
            className="logo"
            src="/brand/logos/venturo-horizontal-light.svg"
            alt="Venturo"
          />
        </a>
        <SiteHeaderNav user={user} />
      </header>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <img className="footer-scene" src="/brand/landing/footer-scene.jpg" alt="" />
      <div className="footer-panel">
      <div className="shell footer-story">
        <div className="footer-story-copy">
          <h2>Go make a story.</h2>
          <p>Discover things to do, find your people &amp; turn “we should” into “remember when”.</p>
        </div>
        <a className="btn btn-primary" href="/directory">
          Find your next adventure
        </a>
      </div>
      <div className="shell footer-grid">
        <div>
          <img className="footer-mark" src="/brand/logos/venturo-stacked-light.svg" alt="Venturo" />
          <p>For the curious. For the memories.</p>
        </div>
        <nav aria-label="Explore">
          <strong>Explore</strong>
          <a href="/directory">Activities</a>
          <a href="/events">Events</a>
          <a href="/communities">Communities</a>
          <a href="/guides">Guides</a>
        </nav>
        <nav aria-label="Get involved">
          <strong>Get involved</strong>
          <a href="/list-your-business">List your activity</a>
          <a href="/account/community">List your community</a>
          <a href="/portal">Host an event</a>
        </nav>
        <nav aria-label="Need a hand">
          <strong>Need a hand?</strong>
          <a href="/support">Contact us</a>
          <a href="/support">FAQs</a>
          <a href="/get-the-app">Get the app</a>
        </nav>
      </div>
      <div className="shell footer-legal">
        <p>© {new Date().getFullYear()} Venturo</p>
        <nav aria-label="Policies">
          <a href="/terms">Terms &amp; Conditions</a>
          <a href="/privacy_policy">Privacy Policy</a>
          <a href="/refunds">Refund Policy</a>
        </nav>
      </div>
      </div>
    </footer>
  );
}
