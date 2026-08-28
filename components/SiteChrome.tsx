import type { CurrentUser } from "@/lib/auth";

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
        <nav className="nav-actions" aria-label="Account">
          <a className="btn btn-ghost" href="/admin">
            Admin
          </a>
          {user ? (
            <>
              <a className="btn btn-ghost" href="/account">
                {user.plan === "paid" ? "Paid Member" : "Free Profile"}
              </a>
              <form action="/auth/sign-out" method="post">
                <button className="btn btn-secondary" type="submit">
                  Sign Out
                </button>
              </form>
            </>
          ) : (
            <>
              <a className="btn btn-ghost" href="/login">
                Log In
              </a>
              <a className="btn btn-primary" href="/signup">
                Sign Up
              </a>
            </>
          )}
        </nav>
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
