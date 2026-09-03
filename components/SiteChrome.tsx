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
    <footer className="site-footer shell">
      <div className="colour-bar footer-bar" aria-hidden="true" />
      <p>Venturo · Activities · Events · Community</p>
      <p className="muted">Quality time is our love language.</p>
    </footer>
  );
}
