import type { CurrentUser } from "@/lib/auth";
import { SiteHeaderNav } from "@/components/SiteHeaderNav";
import { loadWebsiteCopy } from "@/lib/website";

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

export async function SiteFooter() {
  const copy = await loadWebsiteCopy();
  return (
    <footer className="site-footer shell">
      <div className="colour-bar footer-bar" aria-hidden="true" />
      <p>Venturo · Activities · Events · Community</p>
      <p className="muted">Quality time is our love language.</p>
      <nav className="footer-group" aria-label="Here To Help">
        <p className="footer-heading">Here To Help</p>
        <p className="muted footer-links">
          <a href="/support">Support</a>
          <span aria-hidden="true"> · </span>
          <a href="/legal-documents">Legal Documents</a>
        </p>
      </nav>
      <p className="muted footer-links">
        <a href="/about">About</a>
        <span aria-hidden="true"> · </span>
        <a href={copy.appStoreUrl}>App Store</a>
        <span aria-hidden="true"> · </span>
        <a href={copy.playStoreUrl}>Google Play</a>
        <span aria-hidden="true"> · </span>
        <a href={`mailto:${copy.helpEmail}`}>{copy.helpEmail}</a>
      </p>
    </footer>
  );
}
